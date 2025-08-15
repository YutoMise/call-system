/*
 * utils.c - Utility functions for the Assembly HTTP Server
 * These functions provide system call wrappers and common utilities
 */

#define _GNU_SOURCE
#include <unistd.h>
#include <sys/socket.h>
#include <signal.h>
#include <string.h>
#include <strings.h>
#include <stdio.h>
#include <stdlib.h>

// External assembly functions
extern void signal_handler(int sig);

// Print string to stdout
void print_string(const char* str, size_t len) {
    write(STDOUT_FILENO, str, len);
}

// Read from socket with error handling
ssize_t read_socket(int sockfd, void* buffer, size_t size) {
    ssize_t bytes_read = recv(sockfd, buffer, size - 1, 0);
    if (bytes_read > 0) {
        // Null-terminate the buffer
        ((char*)buffer)[bytes_read] = '\0';
    }
    return bytes_read;
}

// Write to socket with error handling
ssize_t write_socket(int sockfd, const void* buffer, size_t size) {
    return send(sockfd, buffer, size, MSG_NOSIGNAL);
}

// Setup signal handlers for graceful shutdown
void setup_signal_handlers(void) {
    signal(SIGINT, signal_handler);   // Ctrl+C
    signal(SIGTERM, signal_handler);  // Termination signal
    signal(SIGPIPE, SIG_IGN);         // Ignore broken pipe
}

// String comparison (case-sensitive)
int string_compare(const char* str1, const char* str2) {
    return strcmp(str1, str2);
}

// String length calculation
size_t string_length(const char* str) {
    return strlen(str);
}

// String copy
char* string_copy(char* dest, const char* src) {
    return strcpy(dest, src);
}

// String copy with length limit
char* string_copy_n(char* dest, const char* src, size_t n) {
    return strncpy(dest, src, n);
}

// String concatenation
char* string_concat(char* dest, const char* src) {
    return strcat(dest, src);
}

// Convert integer to string
int int_to_string(int value, char* buffer, int base) {
    if (base < 2 || base > 36) return 0;
    
    char* ptr = buffer;
    char* ptr1 = buffer;
    char tmp_char;
    int tmp_value;
    
    // Handle negative numbers for base 10
    if (value < 0 && base == 10) {
        *ptr++ = '-';
        value = -value;
        ptr1++;
    }
    
    // Convert to string (reverse order)
    do {
        tmp_value = value;
        value /= base;
        *ptr++ = "0123456789abcdefghijklmnopqrstuvwxyz"[tmp_value - value * base];
    } while (value);
    
    // Null terminate
    *ptr-- = '\0';
    
    // Reverse the string
    while (ptr1 < ptr) {
        tmp_char = *ptr;
        *ptr-- = *ptr1;
        *ptr1++ = tmp_char;
    }
    
    return ptr - buffer + 1;
}

// Convert string to integer
int string_to_int(const char* str) {
    return atoi(str);
}

// Memory allocation wrappers
void* allocate_memory(size_t size) {
    return malloc(size);
}

void free_memory(void* ptr) {
    free(ptr);
}

// Zero memory
void zero_memory(void* ptr, size_t size) {
    memset(ptr, 0, size);
}

// Copy memory
void copy_memory(void* dest, const void* src, size_t size) {
    memcpy(dest, src, size);
}

// Find character in string
char* find_char(const char* str, int ch) {
    return strchr(str, ch);
}

// Find substring in string
char* find_string(const char* haystack, const char* needle) {
    return strstr(haystack, needle);
}

// Case-insensitive string comparison
int string_compare_case_insensitive(const char* str1, const char* str2) {
    return strcasecmp(str1, str2);
}

// Extract method from HTTP request line
int extract_method(const char* request, char* method_buffer, size_t buffer_size) {
    const char* space = find_char(request, ' ');
    if (!space) return -1;
    
    size_t method_len = space - request;
    if (method_len >= buffer_size) return -1;
    
    copy_memory(method_buffer, request, method_len);
    method_buffer[method_len] = '\0';
    return 0;
}

// Extract path from HTTP request line
int extract_path(const char* request, char* path_buffer, size_t buffer_size) {
    const char* first_space = find_char(request, ' ');
    if (!first_space) return -1;
    
    const char* path_start = first_space + 1;
    const char* second_space = find_char(path_start, ' ');
    if (!second_space) return -1;
    
    size_t path_len = second_space - path_start;
    if (path_len >= buffer_size) return -1;
    
    copy_memory(path_buffer, path_start, path_len);
    path_buffer[path_len] = '\0';
    return 0;
}

// Extract headers from HTTP request
int extract_headers(const char* request, char* headers_buffer, size_t buffer_size) {
    const char* headers_start = find_string(request, "\r\n");
    if (!headers_start) return -1;
    
    headers_start += 2; // Skip first \r\n
    const char* headers_end = find_string(headers_start, "\r\n\r\n");
    if (!headers_end) {
        // No body, headers go to end
        size_t headers_len = string_length(headers_start);
        if (headers_len >= buffer_size) return -1;
        string_copy(headers_buffer, headers_start);
        return 0;
    }
    
    size_t headers_len = headers_end - headers_start;
    if (headers_len >= buffer_size) return -1;
    
    copy_memory(headers_buffer, headers_start, headers_len);
    headers_buffer[headers_len] = '\0';
    return 0;
}

// Extract body from HTTP request
int extract_body(const char* request, char* body_buffer, size_t buffer_size) {
    const char* body_start = find_string(request, "\r\n\r\n");
    if (!body_start) {
        body_buffer[0] = '\0';
        return 0; // No body
    }
    
    body_start += 4; // Skip \r\n\r\n
    size_t body_len = string_length(body_start);
    if (body_len >= buffer_size) return -1;
    
    string_copy(body_buffer, body_start);
    return 0;
}
