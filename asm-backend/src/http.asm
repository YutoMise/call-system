; http.asm - HTTP request/response handling
; Target: x86_64 Linux

section .data
    ; HTTP response templates
    http_200_header db "HTTP/1.1 200 OK", 13, 10
                   db "Content-Type: application/json", 13, 10
                   db "Cache-Control: no-cache", 13, 10
                   db "Connection: keep-alive", 13, 10
                   db "Access-Control-Allow-Origin: *", 13, 10
                   db "Content-Length: "
    http_200_len   equ $ - http_200_header
    
    http_404_response db "HTTP/1.1 404 Not Found", 13, 10
                     db "Content-Type: text/plain", 13, 10
                     db "Content-Length: 13", 13, 10, 13, 10
                     db "404 Not Found"
    http_404_len     equ $ - http_404_response
    
    http_500_response db "HTTP/1.1 500 Internal Server Error", 13, 10
                     db "Content-Type: text/plain", 13, 10
                     db "Content-Length: 21", 13, 10, 13, 10
                     db "Internal Server Error"
    http_500_len     equ $ - http_500_response
    
    ; SSE response header
    sse_header      db "HTTP/1.1 200 OK", 13, 10
                   db "Content-Type: text/event-stream", 13, 10
                   db "Cache-Control: no-cache", 13, 10
                   db "Connection: keep-alive", 13, 10
                   db "Access-Control-Allow-Origin: *", 13, 10, 13, 10
    sse_header_len  equ $ - sse_header
    
    ; HTTP methods
    method_get      db "GET ", 0
    method_post     db "POST ", 0
    method_options  db "OPTIONS ", 0
    
    ; Common paths
    path_api_channels    db "/api/channels", 0
    path_api_subscribe   db "/api/subscribe", 0
    path_api_announce    db "/api/announce", 0
    path_events          db "/events", 0
    path_root            db "/", 0
    path_receiver        db "/receiver", 0
    
    ; CRLF
    crlf            db 13, 10, 0
    double_crlf     db 13, 10, 13, 10, 0

    ; File paths
    index_html_path    db "public/index.html", 0
    receiver_html_path db "public/receiver.html", 0

    ; CORS response
    cors_response   db "HTTP/1.1 200 OK", 13, 10
                   db "Access-Control-Allow-Origin: *", 13, 10
                   db "Access-Control-Allow-Methods: GET, POST, OPTIONS", 13, 10
                   db "Access-Control-Allow-Headers: Content-Type", 13, 10
                   db "Content-Length: 0", 13, 10, 13, 10
    cors_response_len equ $ - cors_response

section .bss
    ; Request parsing buffers
    method_buffer   resb 16
    path_buffer     resb 256
    headers_buffer  resb 2048
    body_buffer     resb 4096
    
    ; Response building buffer
    response_buffer resb 8192
    content_length  resq 1

section .text
    global handle_http_request
    extern read_socket
    extern write_socket
    extern parse_json
    extern handle_api_channels
    extern handle_api_subscribe
    extern handle_api_announce
    extern handle_sse_events
    extern serve_static_file
    extern string_compare
    extern string_length
    extern int_to_string
    extern api_set_client_socket
    extern extract_method
    extern extract_path
    extern extract_headers
    extern extract_body
    extern string_copy

; Main HTTP request handler
; Input: rdi = client socket fd, rsi = buffer, rdx = buffer size
; Output: rax = 0 on success, negative on error
handle_http_request:
    push rbp
    mov rbp, rsp
    push rdi
    push rsi
    push rdx

    ; Set client socket for API handlers
    call api_set_client_socket

    ; Read HTTP request from socket
    call read_socket
    test rax, rax
    js .error

    ; Parse HTTP request
    mov rdi, rsi        ; buffer with request
    mov rsi, rax        ; bytes read
    call parse_http_request
    test rax, rax
    js .error

    ; Route the request based on method and path
    call route_request
    test rax, rax
    js .error

    jmp .success

.error:
    ; Send 500 error response
    mov rdi, [rsp + 16] ; client socket
    mov rsi, http_500_response
    mov rdx, http_500_len
    call write_socket
    mov rax, -1

.success:
    pop rdx
    pop rsi
    pop rdi
    mov rsp, rbp
    pop rbp
    ret

; Parse HTTP request into components
; Input: rdi = request buffer, rsi = request length
; Output: rax = 0 on success, negative on error
parse_http_request:
    push rbp
    mov rbp, rsp
    push rdi
    push rsi
    
    ; Parse method (GET, POST, etc.)
    mov rsi, method_buffer
    mov rdx, 16
    call extract_method
    test rax, rax
    js .error
    
    ; Parse path
    mov rdi, [rsp + 8]  ; request buffer
    mov rsi, path_buffer
    mov rdx, 256
    call extract_path
    test rax, rax
    js .error
    
    ; Parse headers (simplified)
    mov rdi, [rsp + 8]  ; request buffer
    mov rsi, headers_buffer
    mov rdx, 2048
    call extract_headers
    
    ; Parse body if present
    mov rdi, [rsp + 8]  ; request buffer
    mov rsi, body_buffer
    mov rdx, 4096
    call extract_body
    
    mov rax, 0
    jmp .success

.error:
    mov rax, -1

.success:
    pop rsi
    pop rdi
    mov rsp, rbp
    pop rbp
    ret

; Route request to appropriate handler
; Input: method_buffer, path_buffer contain parsed request
; Output: rax = 0 on success, negative on error
route_request:
    push rbp
    mov rbp, rsp
    
    ; Check if it's a GET request
    mov rdi, method_buffer
    mov rsi, method_get
    call string_compare
    test rax, rax
    jz .handle_get
    
    ; Check if it's a POST request
    mov rdi, method_buffer
    mov rsi, method_post
    call string_compare
    test rax, rax
    jz .handle_post
    
    ; Check if it's an OPTIONS request (CORS)
    mov rdi, method_buffer
    mov rsi, method_options
    call string_compare
    test rax, rax
    jz .handle_options
    
    ; Unknown method
    jmp .not_found

.handle_get:
    ; Route GET requests
    mov rdi, path_buffer
    mov rsi, path_api_channels
    call string_compare
    test rax, rax
    jz .api_channels
    
    mov rdi, path_buffer
    mov rsi, path_events
    call string_compare
    test rax, rax
    jz .sse_events
    
    mov rdi, path_buffer
    mov rsi, path_root
    call string_compare
    test rax, rax
    jz .serve_index
    
    mov rdi, path_buffer
    mov rsi, path_receiver
    call string_compare
    test rax, rax
    jz .serve_receiver
    
    ; Try to serve as static file
    jmp .serve_static

.handle_post:
    ; Route POST requests
    mov rdi, path_buffer
    mov rsi, path_api_subscribe
    call string_compare
    test rax, rax
    jz .api_subscribe
    
    mov rdi, path_buffer
    mov rsi, path_api_announce
    call string_compare
    test rax, rax
    jz .api_announce
    
    jmp .not_found

.handle_options:
    ; Handle CORS preflight
    call send_cors_response
    jmp .success

.api_channels:
    call handle_api_channels
    jmp .success

.api_subscribe:
    call handle_api_subscribe
    jmp .success

.api_announce:
    call handle_api_announce
    jmp .success

.sse_events:
    call handle_sse_events
    jmp .success

.serve_index:
    mov rdi, index_html_path
    call serve_static_file
    jmp .success

.serve_receiver:
    mov rdi, receiver_html_path
    call serve_static_file
    jmp .success

.serve_static:
    mov rdi, path_buffer
    call serve_static_file
    test rax, rax
    js .not_found
    jmp .success

.not_found:
    call send_404_response
    mov rax, 0  ; Not an error, just not found

.success:
    mov rsp, rbp
    pop rbp
    ret

; Send 404 Not Found response
send_404_response:
    push rbp
    mov rbp, rsp
    
    mov rdi, [rsp + 24] ; client socket (from handle_http_request)
    mov rsi, http_404_response
    mov rdx, http_404_len
    call write_socket
    
    mov rsp, rbp
    pop rbp
    ret

; Send CORS response for OPTIONS requests
send_cors_response:
    push rbp
    mov rbp, rsp

    mov rdi, [rsp + 24] ; client socket
    mov rsi, cors_response
    mov rdx, cors_response_len
    call write_socket

    mov rsp, rbp
    pop rbp
    ret
