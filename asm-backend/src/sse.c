/*
 * sse.c - Server-Sent Events implementation
 * Handles real-time communication with clients
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <pthread.h>
#include <time.h>
#include <errno.h>

#define MAX_CLIENTS 1000
#define MAX_CHANNELS 100
#define KEEPALIVE_INTERVAL 30  // seconds

// SSE client structure
typedef struct sse_client {
    int socket_fd;
    char channel_name[64];
    char session_id[65];
    time_t connected_at;
    time_t last_ping;
    int is_active;
    struct sse_client* next;
} sse_client_t;

// Channel structure for SSE
typedef struct sse_channel {
    char name[64];
    sse_client_t* clients;
    int client_count;
    pthread_mutex_t mutex;
} sse_channel_t;

// Global SSE state
static sse_channel_t channels[MAX_CHANNELS];
static int channel_count = 0;
static pthread_mutex_t global_mutex = PTHREAD_MUTEX_INITIALIZER;
static pthread_t keepalive_thread;
static int sse_running = 0;

// External functions
extern int write_socket(int sockfd, const void* buffer, size_t size);
extern int auth_validate_session(const char* session_id, char* channel_name, int* is_admin);
extern char* auth_extract_session_id(const char* headers);

// Forward declarations
static sse_channel_t* find_or_create_channel(const char* channel_name);
static void remove_client(sse_client_t* client);
static void* keepalive_worker(void* arg);
static int send_sse_message(int socket_fd, const char* event, const char* data);

// Initialize SSE system
int sse_init(void) {
    pthread_mutex_lock(&global_mutex);
    
    // Initialize channels
    for (int i = 0; i < MAX_CHANNELS; i++) {
        channels[i].name[0] = '\0';
        channels[i].clients = NULL;
        channels[i].client_count = 0;
        pthread_mutex_init(&channels[i].mutex, NULL);
    }
    
    sse_running = 1;
    
    // Start keepalive thread
    if (pthread_create(&keepalive_thread, NULL, keepalive_worker, NULL) != 0) {
        sse_running = 0;
        pthread_mutex_unlock(&global_mutex);
        return -1;
    }
    
    pthread_mutex_unlock(&global_mutex);
    return 0;
}

// Shutdown SSE system
void sse_shutdown(void) {
    pthread_mutex_lock(&global_mutex);
    sse_running = 0;
    pthread_mutex_unlock(&global_mutex);
    
    // Wait for keepalive thread to finish
    pthread_join(keepalive_thread, NULL);
    
    // Close all client connections
    for (int i = 0; i < channel_count; i++) {
        pthread_mutex_lock(&channels[i].mutex);
        sse_client_t* client = channels[i].clients;
        while (client) {
            sse_client_t* next = client->next;
            if (client->socket_fd >= 0) {
                close(client->socket_fd);
            }
            free(client);
            client = next;
        }
        channels[i].clients = NULL;
        channels[i].client_count = 0;
        pthread_mutex_unlock(&channels[i].mutex);
        pthread_mutex_destroy(&channels[i].mutex);
    }
}

// Find or create channel
static sse_channel_t* find_or_create_channel(const char* channel_name) {
    // First, try to find existing channel
    for (int i = 0; i < channel_count; i++) {
        if (strcmp(channels[i].name, channel_name) == 0) {
            return &channels[i];
        }
    }
    
    // Create new channel if not found and space available
    if (channel_count < MAX_CHANNELS) {
        sse_channel_t* channel = &channels[channel_count];
        strncpy(channel->name, channel_name, sizeof(channel->name) - 1);
        channel->name[sizeof(channel->name) - 1] = '\0';
        channel->clients = NULL;
        channel->client_count = 0;
        channel_count++;
        return channel;
    }
    
    return NULL;
}

// Remove client from channel
static void remove_client(sse_client_t* client) {
    if (!client) return;
    
    sse_channel_t* channel = find_or_create_channel(client->channel_name);
    if (!channel) return;
    
    pthread_mutex_lock(&channel->mutex);
    
    // Remove from linked list
    if (channel->clients == client) {
        channel->clients = client->next;
    } else {
        sse_client_t* prev = channel->clients;
        while (prev && prev->next != client) {
            prev = prev->next;
        }
        if (prev) {
            prev->next = client->next;
        }
    }
    
    channel->client_count--;
    client->is_active = 0;
    
    if (client->socket_fd >= 0) {
        close(client->socket_fd);
        client->socket_fd = -1;
    }
    
    pthread_mutex_unlock(&channel->mutex);
    free(client);
}

// Send SSE message to client
static int send_sse_message(int socket_fd, const char* event, const char* data) {
    char message[2048];
    int len;
    
    if (event) {
        len = snprintf(message, sizeof(message), "event: %s\ndata: %s\n\n", event, data);
    } else {
        len = snprintf(message, sizeof(message), "data: %s\n\n", data);
    }
    
    if (len >= sizeof(message)) {
        return -1;
    }
    
    return write_socket(socket_fd, message, len) >= 0 ? 0 : -1;
}

// Handle SSE connection
int handle_sse_events(int client_socket, const char* headers) {
    // Extract session ID from headers
    char* session_id = auth_extract_session_id(headers);
    if (!session_id) {
        const char* error_response = 
            "HTTP/1.1 401 Unauthorized\r\n"
            "Content-Type: text/event-stream\r\n"
            "\r\n"
            "event: error\n"
            "data: {\"message\":\"No session found\"}\n\n";
        write_socket(client_socket, error_response, strlen(error_response));
        return -1;
    }
    
    // Validate session and get channel
    char channel_name[64];
    int is_admin = 0;
    if (!auth_validate_session(session_id, channel_name, &is_admin)) {
        free(session_id);
        const char* error_response = 
            "HTTP/1.1 401 Unauthorized\r\n"
            "Content-Type: text/event-stream\r\n"
            "\r\n"
            "event: error\n"
            "data: {\"message\":\"Invalid session\"}\n\n";
        write_socket(client_socket, error_response, strlen(error_response));
        return -1;
    }
    
    if (strlen(channel_name) == 0) {
        free(session_id);
        const char* error_response = 
            "HTTP/1.1 401 Unauthorized\r\n"
            "Content-Type: text/event-stream\r\n"
            "\r\n"
            "event: error\n"
            "data: {\"message\":\"No channel subscription\"}\n\n";
        write_socket(client_socket, error_response, strlen(error_response));
        return -1;
    }
    
    // Send SSE headers
    const char* sse_headers = 
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/event-stream\r\n"
        "Cache-Control: no-cache\r\n"
        "Connection: keep-alive\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "\r\n";
    
    if (write_socket(client_socket, sse_headers, strlen(sse_headers)) < 0) {
        free(session_id);
        return -1;
    }
    
    // Find or create channel
    pthread_mutex_lock(&global_mutex);
    sse_channel_t* channel = find_or_create_channel(channel_name);
    pthread_mutex_unlock(&global_mutex);
    
    if (!channel) {
        free(session_id);
        send_sse_message(client_socket, "error", "{\"message\":\"Channel not available\"}");
        return -1;
    }
    
    // Create client structure
    sse_client_t* client = malloc(sizeof(sse_client_t));
    if (!client) {
        free(session_id);
        send_sse_message(client_socket, "error", "{\"message\":\"Memory allocation failed\"}");
        return -1;
    }
    
    client->socket_fd = client_socket;
    strncpy(client->channel_name, channel_name, sizeof(client->channel_name) - 1);
    client->channel_name[sizeof(client->channel_name) - 1] = '\0';
    strncpy(client->session_id, session_id, sizeof(client->session_id) - 1);
    client->session_id[sizeof(client->session_id) - 1] = '\0';
    client->connected_at = time(NULL);
    client->last_ping = client->connected_at;
    client->is_active = 1;
    client->next = NULL;
    
    // Add client to channel
    pthread_mutex_lock(&channel->mutex);
    client->next = channel->clients;
    channel->clients = client;
    channel->client_count++;
    pthread_mutex_unlock(&channel->mutex);
    
    // Send connection confirmation
    send_sse_message(client_socket, "connected", 
        "{\"message\":\"Connected to event stream\"}");
    
    free(session_id);
    
    // Keep connection alive (this function should not return until client disconnects)
    // In a real implementation, this would be handled by the main server loop
    // For now, we'll return success and let the main loop handle the persistent connection
    return 0;
}

// Send announcement to all clients in a channel
int send_announcement_to_channel(const char* channel_name, const char* ticket_number, const char* room_number) {
    sse_channel_t* channel = NULL;
    
    // Find channel
    pthread_mutex_lock(&global_mutex);
    for (int i = 0; i < channel_count; i++) {
        if (strcmp(channels[i].name, channel_name) == 0) {
            channel = &channels[i];
            break;
        }
    }
    pthread_mutex_unlock(&global_mutex);
    
    if (!channel) {
        return -1; // Channel not found
    }
    
    // Create announcement JSON
    char announcement[512];
    snprintf(announcement, sizeof(announcement),
        "{\"ticketNumber\":\"%s\",\"roomNumber\":\"%s\"}", 
        ticket_number, room_number);
    
    // Send to all clients in channel
    pthread_mutex_lock(&channel->mutex);
    sse_client_t* client = channel->clients;
    int sent_count = 0;
    
    while (client) {
        sse_client_t* next = client->next;
        
        if (client->is_active && client->socket_fd >= 0) {
            if (send_sse_message(client->socket_fd, "play-announcement", announcement) == 0) {
                sent_count++;
            } else {
                // Client disconnected, remove it
                client->is_active = 0;
            }
        }
        
        client = next;
    }
    
    pthread_mutex_unlock(&channel->mutex);
    
    printf("Sent announcement to %d clients in channel '%s': ticket %s, room %s\n",
           sent_count, channel_name, ticket_number, room_number);
    
    return sent_count;
}

// Keepalive worker thread
static void* keepalive_worker(void* arg) {
    (void)arg; // Unused parameter
    
    while (sse_running) {
        sleep(KEEPALIVE_INTERVAL);
        
        if (!sse_running) break;
        
        time_t now = time(NULL);
        
        // Send keepalive to all active clients
        pthread_mutex_lock(&global_mutex);
        for (int i = 0; i < channel_count; i++) {
            pthread_mutex_lock(&channels[i].mutex);
            
            sse_client_t* client = channels[i].clients;
            sse_client_t* prev = NULL;
            
            while (client) {
                sse_client_t* next = client->next;
                
                if (client->is_active && client->socket_fd >= 0) {
                    // Send keepalive ping
                    if (send_sse_message(client->socket_fd, "ping", "{}") != 0) {
                        // Client disconnected
                        client->is_active = 0;
                        if (prev) {
                            prev->next = next;
                        } else {
                            channels[i].clients = next;
                        }
                        channels[i].client_count--;
                        close(client->socket_fd);
                        free(client);
                        client = next;
                        continue;
                    } else {
                        client->last_ping = now;
                    }
                }
                
                prev = client;
                client = next;
            }
            
            pthread_mutex_unlock(&channels[i].mutex);
        }
        pthread_mutex_unlock(&global_mutex);
    }
    
    return NULL;
}

// Get SSE statistics
void sse_get_stats(int* total_clients, int* total_channels) {
    pthread_mutex_lock(&global_mutex);
    
    *total_channels = channel_count;
    *total_clients = 0;
    
    for (int i = 0; i < channel_count; i++) {
        pthread_mutex_lock(&channels[i].mutex);
        *total_clients += channels[i].client_count;
        pthread_mutex_unlock(&channels[i].mutex);
    }
    
    pthread_mutex_unlock(&global_mutex);
}
