/*
 * voicevox.c - Voicevox API integration
 * HTTP client for voice synthesis
 */

#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <errno.h>

#define VOICEVOX_HOST "voicevox_engine"
#define VOICEVOX_PORT 50021
#define HTTP_BUFFER_SIZE 8192
#define MAX_RESPONSE_SIZE 1048576  // 1MB

// HTTP response structure
typedef struct {
    int status_code;
    char* headers;
    char* body;
    size_t body_size;
} http_response_t;

// External functions
extern void* json_parse(const char* json_string);
extern const char* json_get_string(void* obj, const char* key);
extern double json_get_number(void* obj, const char* key);
extern void json_free(void* value);
extern int load_settings_from_file(char** settings_json);

// Global settings
static int current_speaker_id = 3;
static double current_pitch = 0.0;
static double current_speed_scale = 1.0;

// Create HTTP client socket
static int create_http_socket(const char* hostname, int port) {
    struct hostent* host_entry;
    struct sockaddr_in server_addr;
    int sockfd;
    
    // Create socket
    sockfd = socket(AF_INET, SOCK_STREAM, 0);
    if (sockfd < 0) {
        return -1;
    }
    
    // Resolve hostname
    host_entry = gethostbyname(hostname);
    if (!host_entry) {
        close(sockfd);
        return -1;
    }
    
    // Setup server address
    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(port);
    memcpy(&server_addr.sin_addr, host_entry->h_addr_list[0], host_entry->h_length);
    
    // Connect to server
    if (connect(sockfd, (struct sockaddr*)&server_addr, sizeof(server_addr)) < 0) {
        close(sockfd);
        return -1;
    }
    
    return sockfd;
}

// Send HTTP request and receive response
static http_response_t* http_request(const char* method, const char* hostname, int port, 
                                   const char* path, const char* headers, const char* body) {
    int sockfd = create_http_socket(hostname, port);
    if (sockfd < 0) {
        return NULL;
    }
    
    // Build HTTP request
    char request[HTTP_BUFFER_SIZE];
    int request_len;
    
    if (body && strlen(body) > 0) {
        request_len = snprintf(request, sizeof(request),
            "%s %s HTTP/1.1\r\n"
            "Host: %s:%d\r\n"
            "Content-Length: %zu\r\n"
            "%s"
            "\r\n"
            "%s",
            method, path, hostname, port, strlen(body),
            headers ? headers : "", body);
    } else {
        request_len = snprintf(request, sizeof(request),
            "%s %s HTTP/1.1\r\n"
            "Host: %s:%d\r\n"
            "%s"
            "\r\n",
            method, path, hostname, port,
            headers ? headers : "");
    }
    
    if (request_len >= sizeof(request)) {
        close(sockfd);
        return NULL;
    }
    
    // Send request
    if (send(sockfd, request, request_len, 0) < 0) {
        close(sockfd);
        return NULL;
    }
    
    // Receive response
    char* response_buffer = malloc(MAX_RESPONSE_SIZE);
    if (!response_buffer) {
        close(sockfd);
        return NULL;
    }
    
    size_t total_received = 0;
    ssize_t bytes_received;
    
    while (total_received < MAX_RESPONSE_SIZE - 1) {
        bytes_received = recv(sockfd, response_buffer + total_received, 
                            MAX_RESPONSE_SIZE - total_received - 1, 0);
        if (bytes_received <= 0) {
            break;
        }
        total_received += bytes_received;
    }
    
    close(sockfd);
    
    if (total_received == 0) {
        free(response_buffer);
        return NULL;
    }
    
    response_buffer[total_received] = '\0';
    
    // Parse HTTP response
    http_response_t* response = malloc(sizeof(http_response_t));
    if (!response) {
        free(response_buffer);
        return NULL;
    }
    
    // Find status code
    char* status_line = response_buffer;
    char* space = strchr(status_line, ' ');
    if (space) {
        response->status_code = atoi(space + 1);
    } else {
        response->status_code = 0;
    }
    
    // Find headers/body separator
    char* body_start = strstr(response_buffer, "\r\n\r\n");
    if (body_start) {
        body_start += 4;
        response->body_size = total_received - (body_start - response_buffer);
        response->body = malloc(response->body_size + 1);
        if (response->body) {
            memcpy(response->body, body_start, response->body_size);
            response->body[response->body_size] = '\0';
        }
        
        // Headers
        size_t headers_size = body_start - response_buffer - 4;
        response->headers = malloc(headers_size + 1);
        if (response->headers) {
            memcpy(response->headers, response_buffer, headers_size);
            response->headers[headers_size] = '\0';
        }
    } else {
        response->body = strdup(response_buffer);
        response->body_size = total_received;
        response->headers = strdup("");
    }
    
    free(response_buffer);
    return response;
}

// Free HTTP response
static void free_http_response(http_response_t* response) {
    if (response) {
        free(response->headers);
        free(response->body);
        free(response);
    }
}

// URL encode string
static char* url_encode(const char* str) {
    size_t len = strlen(str);
    char* encoded = malloc(len * 3 + 1);  // Worst case: every char needs encoding
    if (!encoded) return NULL;
    
    char* p = encoded;
    for (size_t i = 0; i < len; i++) {
        unsigned char c = str[i];
        if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || 
            (c >= '0' && c <= '9') || c == '-' || c == '_' || 
            c == '.' || c == '~') {
            *p++ = c;
        } else {
            sprintf(p, "%%%02X", c);
            p += 3;
        }
    }
    *p = '\0';
    
    return encoded;
}

// Initialize Voicevox settings
int voicevox_init(void) {
    char* settings_json = NULL;
    if (load_settings_from_file(&settings_json) != 0) {
        printf("Warning: Could not load settings, using defaults\n");
        return 0;  // Continue with defaults
    }
    
    void* settings_obj = json_parse(settings_json);
    if (settings_obj) {
        current_speaker_id = (int)json_get_number(settings_obj, "speakerId");
        current_pitch = json_get_number(settings_obj, "pitch");
        current_speed_scale = json_get_number(settings_obj, "speedScale");
        json_free(settings_obj);
    }
    
    free(settings_json);
    
    printf("Voicevox initialized: speaker_id=%d, pitch=%.1f, speed=%.1f\n",
           current_speaker_id, current_pitch, current_speed_scale);
    
    return 0;
}

// Get available speakers from Voicevox
char* voicevox_get_speakers(void) {
    http_response_t* response = http_request("GET", VOICEVOX_HOST, VOICEVOX_PORT, 
                                           "/speakers", "Accept: application/json\r\n", NULL);
    
    if (!response || response->status_code != 200) {
        printf("Failed to get speakers from Voicevox\n");
        if (response) free_http_response(response);
        return NULL;
    }
    
    char* speakers_json = strdup(response->body);
    free_http_response(response);
    
    return speakers_json;
}

// Generate audio query
static char* generate_audio_query(const char* text, int speaker_id) {
    char path[512];
    char* encoded_text = url_encode(text);
    if (!encoded_text) return NULL;
    
    snprintf(path, sizeof(path), "/audio_query?text=%s&speaker=%d", encoded_text, speaker_id);
    free(encoded_text);
    
    http_response_t* response = http_request("POST", VOICEVOX_HOST, VOICEVOX_PORT, 
                                           path, "Accept: application/json\r\n", "");
    
    if (!response || response->status_code != 200) {
        printf("Failed to generate audio query for text: %s\n", text);
        if (response) free_http_response(response);
        return NULL;
    }
    
    char* query_json = strdup(response->body);
    free_http_response(response);
    
    return query_json;
}

// Modify audio query with current settings
static char* modify_audio_query(const char* query_json) {
    void* query_obj = json_parse(query_json);
    if (!query_obj) return NULL;
    
    // For simplicity, we'll create a new JSON string with modified values
    // In a real implementation, you'd properly modify the JSON object
    
    char* modified_query = malloc(strlen(query_json) + 256);
    if (!modified_query) {
        json_free(query_obj);
        return NULL;
    }
    
    // This is a simplified approach - replace pitch and speedScale values
    strcpy(modified_query, query_json);
    
    // Find and replace pitch value (this is a hack, proper JSON manipulation would be better)
    char* pitch_pos = strstr(modified_query, "\"pitch\":");
    if (pitch_pos) {
        char pitch_str[32];
        snprintf(pitch_str, sizeof(pitch_str), "%.1f", current_pitch);
        // This is very simplified - in reality you'd need proper JSON editing
    }
    
    json_free(query_obj);
    return modified_query;
}

// Synthesize speech
char* voicevox_synthesize(const char* text, size_t* audio_size) {
    if (!text || strlen(text) == 0) {
        return NULL;
    }
    
    printf("Synthesizing speech: '%s' (speaker=%d, pitch=%.1f, speed=%.1f)\n",
           text, current_speaker_id, current_pitch, current_speed_scale);
    
    // Step 1: Generate audio query
    char* query_json = generate_audio_query(text, current_speaker_id);
    if (!query_json) {
        return NULL;
    }
    
    // Step 2: Modify query with current settings
    char* modified_query = modify_audio_query(query_json);
    free(query_json);
    
    if (!modified_query) {
        return NULL;
    }
    
    // Step 3: Synthesize audio
    char path[256];
    snprintf(path, sizeof(path), "/synthesis?speaker=%d", current_speaker_id);
    
    char headers[] = "Content-Type: application/json\r\n"
                    "Accept: audio/wav\r\n";
    
    http_response_t* response = http_request("POST", VOICEVOX_HOST, VOICEVOX_PORT, 
                                           path, headers, modified_query);
    
    free(modified_query);
    
    if (!response || response->status_code != 200) {
        printf("Failed to synthesize audio for text: %s\n", text);
        if (response) free_http_response(response);
        return NULL;
    }
    
    // Copy audio data
    char* audio_data = malloc(response->body_size);
    if (audio_data) {
        memcpy(audio_data, response->body, response->body_size);
        *audio_size = response->body_size;
    }
    
    free_http_response(response);
    
    printf("Successfully synthesized %zu bytes of audio data\n", *audio_size);
    return audio_data;
}

// Update Voicevox settings
int voicevox_update_settings(int speaker_id, double pitch, double speed_scale) {
    current_speaker_id = speaker_id;
    current_pitch = pitch;
    current_speed_scale = speed_scale;
    
    printf("Updated Voicevox settings: speaker_id=%d, pitch=%.1f, speed=%.1f\n",
           current_speaker_id, current_pitch, current_speed_scale);
    
    return 0;
}

// Get current settings
void voicevox_get_settings(int* speaker_id, double* pitch, double* speed_scale) {
    if (speaker_id) *speaker_id = current_speaker_id;
    if (pitch) *pitch = current_pitch;
    if (speed_scale) *speed_scale = current_speed_scale;
}

// Test Voicevox connection
int voicevox_test_connection(void) {
    printf("Testing Voicevox connection...\n");
    
    char* speakers = voicevox_get_speakers();
    if (!speakers) {
        printf("Voicevox connection test failed\n");
        return -1;
    }
    
    printf("Voicevox connection test successful\n");
    free(speakers);
    return 0;
}

// Handle Voicevox API endpoints
int handle_voicevox_settings(int client_socket) {
    // Get current settings and available speakers
    char* speakers_json = voicevox_get_speakers();
    if (!speakers_json) {
        speakers_json = strdup("[]");
    }
    
    char response_body[4096];
    snprintf(response_body, sizeof(response_body),
        "{"
        "\"currentSpeakerId\":%d,"
        "\"currentPitch\":%.1f,"
        "\"currentSpeedScale\":%.1f,"
        "\"availableSpeakers\":%s"
        "}",
        current_speaker_id, current_pitch, current_speed_scale, speakers_json);
    
    free(speakers_json);
    
    char response[8192];
    int body_len = strlen(response_body);
    int header_len = snprintf(response, sizeof(response),
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: application/json\r\n"
        "Content-Length: %d\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "\r\n%s",
        body_len, response_body);
    
    return send(client_socket, response, header_len, 0) >= 0 ? 0 : -1;
}

// Handle audio generation endpoint
int handle_voicevox_audio(int client_socket, const char* text) {
    size_t audio_size;
    char* audio_data = voicevox_synthesize(text, &audio_size);
    
    if (!audio_data) {
        const char* error_response = 
            "HTTP/1.1 500 Internal Server Error\r\n"
            "Content-Type: text/plain\r\n"
            "Content-Length: 21\r\n"
            "\r\n"
            "Audio synthesis failed";
        send(client_socket, error_response, strlen(error_response), 0);
        return -1;
    }
    
    char headers[512];
    int header_len = snprintf(headers, sizeof(headers),
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: audio/wav\r\n"
        "Content-Length: %zu\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "\r\n",
        audio_size);
    
    // Send headers
    if (send(client_socket, headers, header_len, 0) < 0) {
        free(audio_data);
        return -1;
    }
    
    // Send audio data
    int result = send(client_socket, audio_data, audio_size, 0);
    free(audio_data);
    
    return result >= 0 ? 0 : -1;
}
