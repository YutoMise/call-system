/*
 * auth.c - Authentication and session management
 * Secure implementation with password hashing and session tokens
 */

#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include <sys/random.h>
#include <openssl/sha.h>
#include <openssl/evp.h>

#define MAX_SESSIONS 1000
#define SESSION_ID_LENGTH 32
#define SALT_LENGTH 16
#define HASH_LENGTH 32
#define SESSION_TIMEOUT 3600  // 1 hour in seconds

// Session structure
typedef struct {
    char session_id[SESSION_ID_LENGTH * 2 + 1];  // Hex string
    char channel_name[64];
    time_t created_at;
    time_t last_accessed;
    int is_admin;
    int is_active;
} session_t;

// Channel structure
typedef struct {
    char name[64];
    char password_hash[HASH_LENGTH * 2 + 1];  // Hex string
    char salt[SALT_LENGTH * 2 + 1];           // Hex string
} channel_t;

// Global session storage
static session_t sessions[MAX_SESSIONS];
static int session_count = 0;

// Global channel storage (loaded from channels.json)
static channel_t channels[100];
static int channel_count = 0;

// Admin credentials
static char admin_username[64] = "admin";
static char admin_password_hash[HASH_LENGTH * 2 + 1];
static char admin_salt[SALT_LENGTH * 2 + 1];

// Utility functions
static void bytes_to_hex(const unsigned char* bytes, size_t len, char* hex) {
    for (size_t i = 0; i < len; i++) {
        sprintf(hex + i * 2, "%02x", bytes[i]);
    }
    hex[len * 2] = '\0';
}

static void hex_to_bytes(const char* hex, unsigned char* bytes, size_t len) {
    for (size_t i = 0; i < len; i++) {
        sscanf(hex + i * 2, "%2hhx", &bytes[i]);
    }
}

// Generate random bytes
static int generate_random_bytes(unsigned char* buffer, size_t length) {
    return getrandom(buffer, length, 0) == (ssize_t)length ? 0 : -1;
}

// Generate salt for password hashing
static int generate_salt(char* salt_hex) {
    unsigned char salt[SALT_LENGTH];
    if (generate_random_bytes(salt, SALT_LENGTH) != 0) {
        return -1;
    }
    bytes_to_hex(salt, SALT_LENGTH, salt_hex);
    return 0;
}

// Hash password with salt using SHA-256
static int hash_password(const char* password, const char* salt_hex, char* hash_hex) {
    unsigned char salt[SALT_LENGTH];
    hex_to_bytes(salt_hex, salt, SALT_LENGTH);
    
    // Create input: password + salt
    size_t password_len = strlen(password);
    size_t input_len = password_len + SALT_LENGTH;
    unsigned char* input = malloc(input_len);
    if (!input) return -1;
    
    memcpy(input, password, password_len);
    memcpy(input + password_len, salt, SALT_LENGTH);
    
    // Hash with SHA-256
    unsigned char hash[HASH_LENGTH];
    SHA256(input, input_len, hash);
    
    free(input);
    bytes_to_hex(hash, HASH_LENGTH, hash_hex);
    return 0;
}

// Verify password against hash
static int verify_password(const char* password, const char* salt_hex, const char* expected_hash) {
    char computed_hash[HASH_LENGTH * 2 + 1];
    if (hash_password(password, salt_hex, computed_hash) != 0) {
        return 0;
    }
    return strcmp(computed_hash, expected_hash) == 0;
}

// Generate session ID
static int generate_session_id(char* session_id) {
    unsigned char bytes[SESSION_ID_LENGTH];
    if (generate_random_bytes(bytes, SESSION_ID_LENGTH) != 0) {
        return -1;
    }
    bytes_to_hex(bytes, SESSION_ID_LENGTH, session_id);
    return 0;
}

// Find session by ID
static session_t* find_session(const char* session_id) {
    time_t now = time(NULL);
    
    for (int i = 0; i < session_count; i++) {
        if (sessions[i].is_active && 
            strcmp(sessions[i].session_id, session_id) == 0) {
            
            // Check if session has expired
            if (now - sessions[i].last_accessed > SESSION_TIMEOUT) {
                sessions[i].is_active = 0;
                return NULL;
            }
            
            // Update last accessed time
            sessions[i].last_accessed = now;
            return &sessions[i];
        }
    }
    return NULL;
}

// Create new session
static session_t* create_session(const char* channel_name, int is_admin) {
    if (session_count >= MAX_SESSIONS) {
        // Clean up expired sessions
        cleanup_expired_sessions();
        if (session_count >= MAX_SESSIONS) {
            return NULL;
        }
    }
    
    session_t* session = &sessions[session_count];
    
    if (generate_session_id(session->session_id) != 0) {
        return NULL;
    }
    
    strncpy(session->channel_name, channel_name ? channel_name : "", sizeof(session->channel_name) - 1);
    session->channel_name[sizeof(session->channel_name) - 1] = '\0';
    
    time_t now = time(NULL);
    session->created_at = now;
    session->last_accessed = now;
    session->is_admin = is_admin;
    session->is_active = 1;
    
    session_count++;
    return session;
}

// Find channel by name
static channel_t* find_channel(const char* name) {
    for (int i = 0; i < channel_count; i++) {
        if (strcmp(channels[i].name, name) == 0) {
            return &channels[i];
        }
    }
    return NULL;
}

// Public API functions

// Initialize authentication system
int auth_init(void) {
    // Initialize admin password (should be loaded from environment or config)
    const char* admin_password = getenv("ADMIN_PASSWORD");
    if (!admin_password) {
        admin_password = "password";  // Default password
    }
    
    if (generate_salt(admin_salt) != 0) {
        return -1;
    }
    
    if (hash_password(admin_password, admin_salt, admin_password_hash) != 0) {
        return -1;
    }
    
    return 0;
}

// Load channels from configuration
int auth_load_channels(const char* channels_json) {
    // This would parse the channels.json file
    // For now, we'll implement a simple hardcoded example
    
    // Example channel
    strcpy(channels[0].name, "channel1");
    if (generate_salt(channels[0].salt) != 0) {
        return -1;
    }
    if (hash_password("password123", channels[0].salt, channels[0].password_hash) != 0) {
        return -1;
    }
    channel_count = 1;
    
    return 0;
}

// Authenticate admin user
char* auth_admin_login(const char* username, const char* password) {
    if (strcmp(username, admin_username) != 0) {
        return NULL;
    }
    
    if (!verify_password(password, admin_salt, admin_password_hash)) {
        return NULL;
    }
    
    session_t* session = create_session(NULL, 1);
    if (!session) {
        return NULL;
    }
    
    return strdup(session->session_id);
}

// Authenticate channel subscription
char* auth_channel_subscribe(const char* channel_name, const char* password) {
    channel_t* channel = find_channel(channel_name);
    if (!channel) {
        return NULL;
    }
    
    if (!verify_password(password, channel->salt, channel->password_hash)) {
        return NULL;
    }
    
    session_t* session = create_session(channel_name, 0);
    if (!session) {
        return NULL;
    }
    
    return strdup(session->session_id);
}

// Validate session
int auth_validate_session(const char* session_id, char* channel_name, int* is_admin) {
    session_t* session = find_session(session_id);
    if (!session) {
        return 0;
    }
    
    if (channel_name) {
        strcpy(channel_name, session->channel_name);
    }
    
    if (is_admin) {
        *is_admin = session->is_admin;
    }
    
    return 1;
}

// Logout session
void auth_logout(const char* session_id) {
    session_t* session = find_session(session_id);
    if (session) {
        session->is_active = 0;
    }
}

// Cleanup expired sessions
void cleanup_expired_sessions(void) {
    time_t now = time(NULL);
    int write_index = 0;
    
    for (int read_index = 0; read_index < session_count; read_index++) {
        if (sessions[read_index].is_active && 
            (now - sessions[read_index].last_accessed <= SESSION_TIMEOUT)) {
            if (write_index != read_index) {
                sessions[write_index] = sessions[read_index];
            }
            write_index++;
        }
    }
    
    session_count = write_index;
}

// Get session count (for monitoring)
int auth_get_session_count(void) {
    cleanup_expired_sessions();
    return session_count;
}

// Extract session ID from HTTP headers
char* auth_extract_session_id(const char* headers) {
    const char* cookie_header = strstr(headers, "Cookie:");
    if (!cookie_header) {
        return NULL;
    }
    
    const char* session_cookie = strstr(cookie_header, "session_id=");
    if (!session_cookie) {
        return NULL;
    }
    
    session_cookie += 11; // Skip "session_id="
    const char* end = strstr(session_cookie, ";");
    if (!end) {
        end = strstr(session_cookie, "\r\n");
        if (!end) {
            end = session_cookie + strlen(session_cookie);
        }
    }
    
    size_t len = end - session_cookie;
    if (len != SESSION_ID_LENGTH * 2) {
        return NULL;
    }
    
    char* session_id = malloc(len + 1);
    if (!session_id) {
        return NULL;
    }
    
    strncpy(session_id, session_cookie, len);
    session_id[len] = '\0';
    
    return session_id;
}
