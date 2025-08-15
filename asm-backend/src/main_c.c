/*
 * main_c.c - C main function for Assembly HTTP Server
 * Simplified main function to test the server components
 */

#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <signal.h>
#include <string.h>

// External functions from assembly and C modules
extern int create_server_socket(const char* host, int port);
extern int bind_server_socket(int sockfd, const char* host, int port);
extern int listen_server_socket(int sockfd, int backlog);
extern int accept_client_connection(int sockfd);
extern int close_socket(int sockfd);
extern void setup_signal_handlers(void);
extern int handle_http_request(int client_socket, char* buffer, size_t buffer_size);
extern int auth_init(void);
extern int sse_init(void);
extern int voicevox_init(void);
extern void sse_shutdown(void);

// Global variables
static int server_socket = -1;
static volatile int running = 1;

// Signal handler
void signal_handler(int sig) {
    printf("\nReceived signal %d, shutting down...\n", sig);
    running = 0;
    if (server_socket >= 0) {
        close_socket(server_socket);
    }
}

int main(void) {
    printf("Assembly HTTP Server starting on port 3003...\n");
    
    // Setup signal handlers
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);
    signal(SIGPIPE, SIG_IGN);
    
    // Initialize subsystems
    printf("Initializing authentication system...\n");
    if (auth_init() != 0) {
        fprintf(stderr, "Failed to initialize authentication system\n");
        return 1;
    }
    
    printf("Initializing SSE system...\n");
    if (sse_init() != 0) {
        fprintf(stderr, "Failed to initialize SSE system\n");
        return 1;
    }
    
    printf("Initializing Voicevox system...\n");
    if (voicevox_init() != 0) {
        fprintf(stderr, "Warning: Failed to initialize Voicevox system\n");
        // Continue without Voicevox
    }
    
    // Create server socket
    printf("Creating server socket...\n");
    server_socket = create_server_socket("0.0.0.0", 3003);
    if (server_socket < 0) {
        fprintf(stderr, "Failed to create server socket\n");
        return 1;
    }
    
    // Bind socket to address
    printf("Binding socket to address...\n");
    if (bind_server_socket(server_socket, "0.0.0.0", 3003) != 0) {
        fprintf(stderr, "Failed to bind socket\n");
        close_socket(server_socket);
        return 1;
    }
    
    // Start listening for connections
    printf("Starting to listen for connections...\n");
    if (listen_server_socket(server_socket, 128) != 0) {
        fprintf(stderr, "Failed to listen on socket\n");
        close_socket(server_socket);
        return 1;
    }
    
    printf("Server is ready and listening on port 3003\n");
    printf("Press Ctrl+C to stop the server\n");
    
    // Main server loop
    char request_buffer[8192];
    while (running) {
        // Accept client connection
        int client_socket = accept_client_connection(server_socket);
        if (client_socket < 0) {
            if (running) {
                fprintf(stderr, "Failed to accept client connection\n");
            }
            continue;
        }
        
        printf("Accepted client connection: %d\n", client_socket);
        
        // Handle the HTTP request
        if (handle_http_request(client_socket, request_buffer, sizeof(request_buffer)) != 0) {
            fprintf(stderr, "Failed to handle HTTP request\n");
        }
        
        // Close client connection
        close_socket(client_socket);
        printf("Closed client connection: %d\n", client_socket);
    }
    
    // Cleanup
    printf("Shutting down server...\n");
    if (server_socket >= 0) {
        close_socket(server_socket);
    }
    
    sse_shutdown();
    
    printf("Server shutdown complete\n");
    return 0;
}
