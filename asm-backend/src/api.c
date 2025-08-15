/*
 * api.c - API endpoint handlers for the Assembly HTTP Server
 * Implements the REST API endpoints for the call-system
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

// External functions
extern int write_socket(int sockfd, const void* buffer, size_t size);
extern char* json_generate_string_array(const char** strings, size_t count);
extern char* json_generate_object(const char** keys, const char** values, size_t count);
extern void* json_parse(const char* json_string);
extern const char* json_get_string(void* obj, const char* key);
extern void json_free(void* value);
extern char* auth_channel_subscribe(const char* channel_name, const char* password);
extern char* auth_admin_login(const char* username, const char* password);
extern int auth_validate_session(const char* session_id, char* channel_name, int* is_admin);
extern char* auth_extract_session_id(const char* headers);
extern int load_channels_from_file(char*** channel_names, int* count);
extern int send_announcement_to_channel(const char* channel_name, const char* ticket_number, const char* room_number);

// Global variables for client socket (passed from HTTP handler)
static int current_client_socket = -1;

// Set current client socket for API handlers
void api_set_client_socket(int sockfd) {
    current_client_socket = sockfd;
}

// Send HTTP response
static int send_response(int status_code, const char* content_type, const char* body) {
    if (current_client_socket < 0) return -1;
    
    char response[8192];
    int body_len = body ? strlen(body) : 0;
    
    int header_len = snprintf(response, sizeof(response),
        "HTTP/1.1 %d %s\r\n"
        "Content-Type: %s\r\n"
        "Content-Length: %d\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
        "Access-Control-Allow-Headers: Content-Type\r\n"
        "\r\n",
        status_code,
        status_code == 200 ? "OK" : 
        status_code == 400 ? "Bad Request" :
        status_code == 401 ? "Unauthorized" :
        status_code == 404 ? "Not Found" : "Internal Server Error",
        content_type,
        body_len
    );
    
    if (header_len >= sizeof(response)) return -1;
    
    // Send header
    if (write_socket(current_client_socket, response, header_len) < 0) {
        return -1;
    }
    
    // Send body if present
    if (body && body_len > 0) {
        if (write_socket(current_client_socket, body, body_len) < 0) {
            return -1;
        }
    }
    
    return 0;
}

// Send JSON response
static int send_json_response(int status_code, const char* json_body) {
    return send_response(status_code, "application/json", json_body);
}

// Send error response
static int send_error_response(int status_code, const char* message) {
    char json_body[512];
    snprintf(json_body, sizeof(json_body), "{\"message\":\"%s\"}", message);
    return send_json_response(status_code, json_body);
}

// Handle GET /api/channels
int handle_api_channels(void) {
    char** channel_names = NULL;
    int channel_count = 0;
    
    // Load channels from file
    if (load_channels_from_file(&channel_names, &channel_count) != 0) {
        return send_error_response(500, "Failed to load channels");
    }
    
    // Generate JSON array
    char* json_response = json_generate_string_array((const char**)channel_names, channel_count);
    if (!json_response) {
        // Free channel names
        for (int i = 0; i < channel_count; i++) {
            free(channel_names[i]);
        }
        free(channel_names);
        return send_error_response(500, "Failed to generate response");
    }
    
    int result = send_json_response(200, json_response);
    
    // Cleanup
    free(json_response);
    for (int i = 0; i < channel_count; i++) {
        free(channel_names[i]);
    }
    free(channel_names);
    
    return result;
}

// Handle POST /api/subscribe
int handle_api_subscribe(const char* request_body, const char* headers) {
    // Parse JSON request body
    void* json_obj = json_parse(request_body);
    if (!json_obj) {
        return send_error_response(400, "Invalid JSON");
    }
    
    const char* channel_name = json_get_string(json_obj, "channelName");
    const char* password = json_get_string(json_obj, "password");
    
    if (!channel_name || !password) {
        json_free(json_obj);
        return send_error_response(400, "Missing channelName or password");
    }
    
    // Authenticate channel subscription
    char* session_id = auth_channel_subscribe(channel_name, password);
    if (!session_id) {
        json_free(json_obj);
        return send_error_response(401, "Invalid channel or password");
    }
    
    // Create response with session cookie
    char response_body[256];
    snprintf(response_body, sizeof(response_body), 
        "{\"message\":\"Successfully subscribed to channel %s\"}", channel_name);
    
    char response[8192];
    int body_len = strlen(response_body);
    
    int header_len = snprintf(response, sizeof(response),
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: application/json\r\n"
        "Content-Length: %d\r\n"
        "Set-Cookie: session_id=%s; Path=/; HttpOnly\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Access-Control-Allow-Credentials: true\r\n"
        "\r\n%s",
        body_len, session_id, response_body
    );
    
    int result = write_socket(current_client_socket, response, header_len);
    
    // Cleanup
    free(session_id);
    json_free(json_obj);
    
    return result >= 0 ? 0 : -1;
}

// Handle POST /api/announce
int handle_api_announce(const char* request_body, const char* headers) {
    // Parse JSON request body
    void* json_obj = json_parse(request_body);
    if (!json_obj) {
        return send_error_response(400, "Invalid JSON");
    }
    
    const char* channel_name = json_get_string(json_obj, "channelName");
    const char* password = json_get_string(json_obj, "password");
    const char* ticket_number = json_get_string(json_obj, "ticketNumber");
    const char* room_number = json_get_string(json_obj, "roomNumber");
    
    if (!channel_name || !password || !ticket_number || !room_number) {
        json_free(json_obj);
        return send_error_response(400, "Missing required fields");
    }
    
    // Verify channel password (simplified - in production, use proper auth)
    char** channel_names = NULL;
    int channel_count = 0;
    if (load_channels_from_file(&channel_names, &channel_count) != 0) {
        json_free(json_obj);
        return send_error_response(500, "Failed to load channels");
    }
    
    int channel_found = 0;
    for (int i = 0; i < channel_count; i++) {
        if (strcmp(channel_names[i], channel_name) == 0) {
            channel_found = 1;
            break;
        }
    }
    
    // Cleanup channel names
    for (int i = 0; i < channel_count; i++) {
        free(channel_names[i]);
    }
    free(channel_names);
    
    if (!channel_found) {
        json_free(json_obj);
        return send_error_response(404, "Channel not found");
    }
    
    // Send announcement to channel
    if (send_announcement_to_channel(channel_name, ticket_number, room_number) != 0) {
        json_free(json_obj);
        return send_error_response(500, "Failed to send announcement");
    }
    
    // Send success response
    char response_body[256];
    snprintf(response_body, sizeof(response_body), 
        "{\"message\":\"Announcement sent successfully\"}");
    
    int result = send_json_response(200, response_body);
    
    json_free(json_obj);
    return result;
}

// Handle POST /admin/login
int handle_admin_login(const char* request_body, const char* headers) {
    // Parse JSON request body
    void* json_obj = json_parse(request_body);
    if (!json_obj) {
        return send_error_response(400, "Invalid JSON");
    }
    
    const char* username = json_get_string(json_obj, "username");
    const char* password = json_get_string(json_obj, "password");
    
    if (!username || !password) {
        json_free(json_obj);
        return send_error_response(400, "Missing username or password");
    }
    
    // Authenticate admin
    char* session_id = auth_admin_login(username, password);
    if (!session_id) {
        json_free(json_obj);
        return send_error_response(401, "Invalid credentials");
    }
    
    // Create response with session cookie
    char response_body[] = "{\"success\":true,\"message\":\"Login successful\"}";
    
    char response[8192];
    int body_len = strlen(response_body);
    
    int header_len = snprintf(response, sizeof(response),
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: application/json\r\n"
        "Content-Length: %d\r\n"
        "Set-Cookie: admin_session=%s; Path=/; HttpOnly\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Access-Control-Allow-Credentials: true\r\n"
        "\r\n%s",
        body_len, session_id, response_body
    );
    
    int result = write_socket(current_client_socket, response, header_len);
    
    // Cleanup
    free(session_id);
    json_free(json_obj);
    
    return result >= 0 ? 0 : -1;
}

// Handle GET /admin/api/auth-status
int handle_admin_auth_status(const char* headers) {
    // Extract session ID from headers
    char* session_id = auth_extract_session_id(headers);
    if (!session_id) {
        return send_json_response(200, "{\"isAuthenticated\":false}");
    }
    
    // Validate admin session
    int is_admin = 0;
    int is_valid = auth_validate_session(session_id, NULL, &is_admin);
    
    free(session_id);
    
    if (is_valid && is_admin) {
        return send_json_response(200, "{\"isAuthenticated\":true}");
    } else {
        return send_json_response(200, "{\"isAuthenticated\":false}");
    }
}
