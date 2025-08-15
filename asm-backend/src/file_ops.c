/*
 * file_ops.c - File operations and data persistence
 * Handles JSON file I/O and static file serving
 */

#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <unistd.h>
#include <sys/stat.h>
#include <sys/mman.h>
#include <fcntl.h>
#include <errno.h>

// External functions
extern int write_socket(int sockfd, const void* buffer, size_t size);
extern void* json_parse(const char* json_string);
extern const char* json_get_string(void* obj, const char* key);
extern void json_free(void* value);

// MIME type mapping
typedef struct {
    const char* extension;
    const char* mime_type;
} mime_mapping_t;

static const mime_mapping_t mime_types[] = {
    {".html", "text/html"},
    {".css", "text/css"},
    {".js", "application/javascript"},
    {".json", "application/json"},
    {".png", "image/png"},
    {".jpg", "image/jpeg"},
    {".jpeg", "image/jpeg"},
    {".gif", "image/gif"},
    {".svg", "image/svg+xml"},
    {".ico", "image/x-icon"},
    {".txt", "text/plain"},
    {".wav", "audio/wav"},
    {".mp3", "audio/mpeg"},
    {NULL, "application/octet-stream"}
};

// Get MIME type from file extension
static const char* get_mime_type(const char* filename) {
    const char* ext = strrchr(filename, '.');
    if (!ext) return "application/octet-stream";
    
    for (int i = 0; mime_types[i].extension; i++) {
        if (strcasecmp(ext, mime_types[i].extension) == 0) {
            return mime_types[i].mime_type;
        }
    }
    
    return "application/octet-stream";
}

// Read entire file into memory
static char* read_file(const char* filename, size_t* file_size) {
    FILE* file = fopen(filename, "rb");
    if (!file) {
        return NULL;
    }
    
    // Get file size
    fseek(file, 0, SEEK_END);
    long size = ftell(file);
    fseek(file, 0, SEEK_SET);
    
    if (size < 0) {
        fclose(file);
        return NULL;
    }
    
    // Allocate buffer
    char* buffer = malloc(size + 1);
    if (!buffer) {
        fclose(file);
        return NULL;
    }
    
    // Read file
    size_t bytes_read = fread(buffer, 1, size, file);
    fclose(file);
    
    if (bytes_read != (size_t)size) {
        free(buffer);
        return NULL;
    }
    
    buffer[size] = '\0';
    if (file_size) *file_size = size;
    
    return buffer;
}

// Write data to file
static int write_file(const char* filename, const char* data, size_t size) {
    FILE* file = fopen(filename, "wb");
    if (!file) {
        return -1;
    }
    
    size_t bytes_written = fwrite(data, 1, size, file);
    fclose(file);
    
    return bytes_written == size ? 0 : -1;
}

// Load channels from JSON file
int load_channels_from_file(char*** channel_names, int* count) {
    size_t file_size;
    char* json_data = read_file("channels.json", &file_size);
    if (!json_data) {
        return -1;
    }
    
    void* json_obj = json_parse(json_data);
    free(json_data);
    
    if (!json_obj) {
        return -1;
    }
    
    // For simplicity, assume channels.json is an array of channel objects
    // In a real implementation, you'd parse the actual structure
    
    // Hardcoded example for now
    *count = 2;
    *channel_names = malloc(*count * sizeof(char*));
    if (!*channel_names) {
        json_free(json_obj);
        return -1;
    }
    
    (*channel_names)[0] = strdup("channel1");
    (*channel_names)[1] = strdup("channel2");
    
    json_free(json_obj);
    return 0;
}

// Save channels to JSON file
int save_channels_to_file(const char* json_data) {
    return write_file("channels.json", json_data, strlen(json_data));
}

// Load settings from JSON file
int load_settings_from_file(char** settings_json) {
    size_t file_size;
    char* data = read_file("settings.json", &file_size);
    if (!data) {
        // Create default settings if file doesn't exist
        const char* default_settings = 
            "{"
            "\"speakerId\":3,"
            "\"pitch\":0.0,"
            "\"speedScale\":1.0"
            "}";
        *settings_json = strdup(default_settings);
        return *settings_json ? 0 : -1;
    }
    
    *settings_json = data;
    return 0;
}

// Save settings to JSON file
int save_settings_to_file(const char* json_data) {
    return write_file("settings.json", json_data, strlen(json_data));
}

// Serve static file
int serve_static_file(int client_socket, const char* path) {
    // Security check: prevent directory traversal
    if (strstr(path, "..") || strstr(path, "//")) {
        const char* error_response = 
            "HTTP/1.1 403 Forbidden\r\n"
            "Content-Type: text/plain\r\n"
            "Content-Length: 9\r\n"
            "\r\n"
            "Forbidden";
        write_socket(client_socket, error_response, strlen(error_response));
        return -1;
    }
    
    // Build full file path
    char full_path[512];
    if (path[0] == '/') {
        snprintf(full_path, sizeof(full_path), "public%s", path);
    } else {
        snprintf(full_path, sizeof(full_path), "public/%s", path);
    }
    
    // Check if file exists and is readable
    struct stat file_stat;
    if (stat(full_path, &file_stat) != 0 || !S_ISREG(file_stat.st_mode)) {
        const char* error_response = 
            "HTTP/1.1 404 Not Found\r\n"
            "Content-Type: text/plain\r\n"
            "Content-Length: 13\r\n"
            "\r\n"
            "404 Not Found";
        write_socket(client_socket, error_response, strlen(error_response));
        return -1;
    }
    
    // Open file
    int fd = open(full_path, O_RDONLY);
    if (fd < 0) {
        const char* error_response = 
            "HTTP/1.1 500 Internal Server Error\r\n"
            "Content-Type: text/plain\r\n"
            "Content-Length: 21\r\n"
            "\r\n"
            "Internal Server Error";
        write_socket(client_socket, error_response, strlen(error_response));
        return -1;
    }
    
    // Get MIME type
    const char* mime_type = get_mime_type(full_path);
    
    // Send HTTP headers
    char headers[1024];
    int header_len = snprintf(headers, sizeof(headers),
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: %s\r\n"
        "Content-Length: %ld\r\n"
        "Cache-Control: public, max-age=3600\r\n"
        "\r\n",
        mime_type, file_stat.st_size);
    
    if (write_socket(client_socket, headers, header_len) < 0) {
        close(fd);
        return -1;
    }
    
    // Send file content using memory mapping for efficiency
    void* file_data = mmap(NULL, file_stat.st_size, PROT_READ, MAP_PRIVATE, fd, 0);
    if (file_data == MAP_FAILED) {
        close(fd);
        return -1;
    }
    
    int result = write_socket(client_socket, file_data, file_stat.st_size);
    
    munmap(file_data, file_stat.st_size);
    close(fd);
    
    return result >= 0 ? 0 : -1;
}

// Create backup of a file
int backup_file(const char* filename) {
    char backup_name[512];
    snprintf(backup_name, sizeof(backup_name), "%s.backup", filename);
    
    size_t file_size;
    char* data = read_file(filename, &file_size);
    if (!data) {
        return -1;
    }
    
    int result = write_file(backup_name, data, file_size);
    free(data);
    
    return result;
}

// Restore file from backup
int restore_file(const char* filename) {
    char backup_name[512];
    snprintf(backup_name, sizeof(backup_name), "%s.backup", filename);
    
    size_t file_size;
    char* data = read_file(backup_name, &file_size);
    if (!data) {
        return -1;
    }
    
    int result = write_file(filename, data, file_size);
    free(data);
    
    return result;
}

// Check if file exists
int file_exists(const char* filename) {
    struct stat file_stat;
    return stat(filename, &file_stat) == 0 && S_ISREG(file_stat.st_mode);
}

// Get file size
long get_file_size(const char* filename) {
    struct stat file_stat;
    if (stat(filename, &file_stat) != 0) {
        return -1;
    }
    return file_stat.st_size;
}

// Create directory if it doesn't exist
int create_directory(const char* path) {
    struct stat st;
    if (stat(path, &st) == 0) {
        return S_ISDIR(st.st_mode) ? 0 : -1;
    }
    
    return mkdir(path, 0755);
}

// List files in directory (for debugging/admin purposes)
int list_directory(const char* path, char*** filenames, int* count) {
    // This would use opendir/readdir to list files
    // For now, return empty list
    *filenames = NULL;
    *count = 0;
    return 0;
}

// Atomic file write (write to temp file, then rename)
int atomic_write_file(const char* filename, const char* data, size_t size) {
    char temp_name[512];
    snprintf(temp_name, sizeof(temp_name), "%s.tmp", filename);
    
    // Write to temporary file
    if (write_file(temp_name, data, size) != 0) {
        return -1;
    }
    
    // Atomically replace original file
    if (rename(temp_name, filename) != 0) {
        unlink(temp_name); // Clean up temp file
        return -1;
    }
    
    return 0;
}

// Read file with error handling and logging
char* safe_read_file(const char* filename, size_t* file_size) {
    printf("Reading file: %s\n", filename);
    
    char* data = read_file(filename, file_size);
    if (!data) {
        printf("Failed to read file: %s (error: %s)\n", filename, strerror(errno));
        return NULL;
    }
    
    printf("Successfully read %zu bytes from %s\n", *file_size, filename);
    return data;
}

// Write file with error handling and logging
int safe_write_file(const char* filename, const char* data, size_t size) {
    printf("Writing %zu bytes to file: %s\n", size, filename);
    
    // Create backup first
    if (file_exists(filename)) {
        if (backup_file(filename) != 0) {
            printf("Warning: Failed to create backup of %s\n", filename);
        }
    }
    
    // Write file atomically
    if (atomic_write_file(filename, data, size) != 0) {
        printf("Failed to write file: %s (error: %s)\n", filename, strerror(errno));
        return -1;
    }
    
    printf("Successfully wrote file: %s\n", filename);
    return 0;
}
