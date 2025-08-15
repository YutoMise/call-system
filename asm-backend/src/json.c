/*
 * json.c - JSON parsing and generation for the Assembly HTTP Server
 * Lightweight JSON implementation optimized for the call-system API
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

// JSON token types
typedef enum {
    JSON_NULL,
    JSON_BOOL,
    JSON_NUMBER,
    JSON_STRING,
    JSON_ARRAY,
    JSON_OBJECT
} json_type_t;

// JSON value structure
typedef struct json_value {
    json_type_t type;
    union {
        int boolean;
        double number;
        char* string;
        struct {
            struct json_value** items;
            size_t count;
        } array;
        struct {
            char** keys;
            struct json_value** values;
            size_t count;
        } object;
    } data;
} json_value_t;

// Forward declarations
static json_value_t* parse_value(const char** json);
static void skip_whitespace(const char** json);
static char* parse_string(const char** json);
static double parse_number(const char** json);
static json_value_t* parse_object(const char** json);
static json_value_t* parse_array(const char** json);

// Skip whitespace characters
static void skip_whitespace(const char** json) {
    while (**json && isspace(**json)) {
        (*json)++;
    }
}

// Parse JSON string
static char* parse_string(const char** json) {
    if (**json != '"') return NULL;
    (*json)++; // Skip opening quote
    
    const char* start = *json;
    while (**json && **json != '"') {
        if (**json == '\\') {
            (*json)++; // Skip escape character
            if (**json) (*json)++; // Skip escaped character
        } else {
            (*json)++;
        }
    }
    
    if (**json != '"') return NULL;
    
    size_t len = *json - start;
    char* result = malloc(len + 1);
    if (!result) return NULL;
    
    strncpy(result, start, len);
    result[len] = '\0';
    
    (*json)++; // Skip closing quote
    return result;
}

// Parse JSON number
static double parse_number(const char** json) {
    char* end;
    double result = strtod(*json, &end);
    *json = end;
    return result;
}

// Parse JSON object
static json_value_t* parse_object(const char** json) {
    if (**json != '{') return NULL;
    (*json)++; // Skip opening brace
    
    json_value_t* obj = malloc(sizeof(json_value_t));
    if (!obj) return NULL;
    
    obj->type = JSON_OBJECT;
    obj->data.object.keys = NULL;
    obj->data.object.values = NULL;
    obj->data.object.count = 0;
    
    skip_whitespace(json);
    
    if (**json == '}') {
        (*json)++; // Empty object
        return obj;
    }
    
    size_t capacity = 4;
    obj->data.object.keys = malloc(capacity * sizeof(char*));
    obj->data.object.values = malloc(capacity * sizeof(json_value_t*));
    
    if (!obj->data.object.keys || !obj->data.object.values) {
        free(obj);
        return NULL;
    }
    
    while (**json) {
        skip_whitespace(json);
        
        // Parse key
        char* key = parse_string(json);
        if (!key) break;
        
        skip_whitespace(json);
        if (**json != ':') {
            free(key);
            break;
        }
        (*json)++; // Skip colon
        
        skip_whitespace(json);
        
        // Parse value
        json_value_t* value = parse_value(json);
        if (!value) {
            free(key);
            break;
        }
        
        // Resize arrays if needed
        if (obj->data.object.count >= capacity) {
            capacity *= 2;
            obj->data.object.keys = realloc(obj->data.object.keys, capacity * sizeof(char*));
            obj->data.object.values = realloc(obj->data.object.values, capacity * sizeof(json_value_t*));
        }
        
        obj->data.object.keys[obj->data.object.count] = key;
        obj->data.object.values[obj->data.object.count] = value;
        obj->data.object.count++;
        
        skip_whitespace(json);
        
        if (**json == '}') {
            (*json)++;
            break;
        } else if (**json == ',') {
            (*json)++;
        } else {
            break;
        }
    }
    
    return obj;
}

// Parse JSON array
static json_value_t* parse_array(const char** json) {
    if (**json != '[') return NULL;
    (*json)++; // Skip opening bracket
    
    json_value_t* arr = malloc(sizeof(json_value_t));
    if (!arr) return NULL;
    
    arr->type = JSON_ARRAY;
    arr->data.array.items = NULL;
    arr->data.array.count = 0;
    
    skip_whitespace(json);
    
    if (**json == ']') {
        (*json)++; // Empty array
        return arr;
    }
    
    size_t capacity = 4;
    arr->data.array.items = malloc(capacity * sizeof(json_value_t*));
    
    if (!arr->data.array.items) {
        free(arr);
        return NULL;
    }
    
    while (**json) {
        skip_whitespace(json);
        
        json_value_t* value = parse_value(json);
        if (!value) break;
        
        // Resize array if needed
        if (arr->data.array.count >= capacity) {
            capacity *= 2;
            arr->data.array.items = realloc(arr->data.array.items, capacity * sizeof(json_value_t*));
        }
        
        arr->data.array.items[arr->data.array.count] = value;
        arr->data.array.count++;
        
        skip_whitespace(json);
        
        if (**json == ']') {
            (*json)++;
            break;
        } else if (**json == ',') {
            (*json)++;
        } else {
            break;
        }
    }
    
    return arr;
}

// Parse JSON value
static json_value_t* parse_value(const char** json) {
    skip_whitespace(json);
    
    if (!**json) return NULL;
    
    json_value_t* value = malloc(sizeof(json_value_t));
    if (!value) return NULL;
    
    switch (**json) {
        case '"':
            value->type = JSON_STRING;
            value->data.string = parse_string(json);
            if (!value->data.string) {
                free(value);
                return NULL;
            }
            break;
            
        case '{':
            free(value);
            return parse_object(json);
            
        case '[':
            free(value);
            return parse_array(json);
            
        case 't':
            if (strncmp(*json, "true", 4) == 0) {
                value->type = JSON_BOOL;
                value->data.boolean = 1;
                *json += 4;
            } else {
                free(value);
                return NULL;
            }
            break;
            
        case 'f':
            if (strncmp(*json, "false", 5) == 0) {
                value->type = JSON_BOOL;
                value->data.boolean = 0;
                *json += 5;
            } else {
                free(value);
                return NULL;
            }
            break;
            
        case 'n':
            if (strncmp(*json, "null", 4) == 0) {
                value->type = JSON_NULL;
                *json += 4;
            } else {
                free(value);
                return NULL;
            }
            break;
            
        default:
            if (isdigit(**json) || **json == '-') {
                value->type = JSON_NUMBER;
                value->data.number = parse_number(json);
            } else {
                free(value);
                return NULL;
            }
            break;
    }
    
    return value;
}

// Public API functions

// Parse JSON string
json_value_t* json_parse(const char* json_string) {
    const char* json = json_string;
    return parse_value(&json);
}

// Get string value from JSON object
const char* json_get_string(json_value_t* obj, const char* key) {
    if (!obj || obj->type != JSON_OBJECT) return NULL;
    
    for (size_t i = 0; i < obj->data.object.count; i++) {
        if (strcmp(obj->data.object.keys[i], key) == 0) {
            json_value_t* value = obj->data.object.values[i];
            if (value->type == JSON_STRING) {
                return value->data.string;
            }
        }
    }
    return NULL;
}

// Get number value from JSON object
double json_get_number(json_value_t* obj, const char* key) {
    if (!obj || obj->type != JSON_OBJECT) return 0.0;
    
    for (size_t i = 0; i < obj->data.object.count; i++) {
        if (strcmp(obj->data.object.keys[i], key) == 0) {
            json_value_t* value = obj->data.object.values[i];
            if (value->type == JSON_NUMBER) {
                return value->data.number;
            }
        }
    }
    return 0.0;
}

// Generate JSON string from array of strings
char* json_generate_string_array(const char** strings, size_t count) {
    size_t total_len = 3; // "[]" + null terminator
    
    // Calculate total length needed
    for (size_t i = 0; i < count; i++) {
        total_len += strlen(strings[i]) + 3; // quotes + comma/space
    }
    
    char* result = malloc(total_len);
    if (!result) return NULL;
    
    strcpy(result, "[");
    
    for (size_t i = 0; i < count; i++) {
        if (i > 0) strcat(result, ",");
        strcat(result, "\"");
        strcat(result, strings[i]);
        strcat(result, "\"");
    }
    
    strcat(result, "]");
    return result;
}

// Generate simple JSON object
char* json_generate_object(const char** keys, const char** values, size_t count) {
    size_t total_len = 3; // "{}" + null terminator
    
    // Calculate total length needed
    for (size_t i = 0; i < count; i++) {
        total_len += strlen(keys[i]) + strlen(values[i]) + 7; // quotes, colon, comma
    }
    
    char* result = malloc(total_len);
    if (!result) return NULL;
    
    strcpy(result, "{");
    
    for (size_t i = 0; i < count; i++) {
        if (i > 0) strcat(result, ",");
        strcat(result, "\"");
        strcat(result, keys[i]);
        strcat(result, "\":\"");
        strcat(result, values[i]);
        strcat(result, "\"");
    }
    
    strcat(result, "}");
    return result;
}

// Free JSON value
void json_free(json_value_t* value) {
    if (!value) return;
    
    switch (value->type) {
        case JSON_STRING:
            free(value->data.string);
            break;
            
        case JSON_ARRAY:
            for (size_t i = 0; i < value->data.array.count; i++) {
                json_free(value->data.array.items[i]);
            }
            free(value->data.array.items);
            break;
            
        case JSON_OBJECT:
            for (size_t i = 0; i < value->data.object.count; i++) {
                free(value->data.object.keys[i]);
                json_free(value->data.object.values[i]);
            }
            free(value->data.object.keys);
            free(value->data.object.values);
            break;
            
        default:
            break;
    }
    
    free(value);
}
