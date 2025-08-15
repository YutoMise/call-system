; main.asm - Entry point for the Assembly HTTP Server
; Target: x86_64 Linux

section .data
    ; Server configuration
    server_port     dw 3003
    server_host     db "0.0.0.0", 0
    
    ; Messages
    startup_msg     db "Assembly HTTP Server starting on port 3003...", 10, 0
    startup_len     equ $ - startup_msg - 1
    
    error_msg       db "Server startup failed", 10, 0
    error_len       equ $ - error_msg - 1
    
    shutdown_msg    db "Server shutting down...", 10, 0
    shutdown_len    equ $ - shutdown_msg - 1

section .bss
    ; Socket file descriptor
    server_socket   resq 1
    client_socket   resq 1
    
    ; Buffer for incoming requests
    request_buffer  resb 8192
    
    ; Server address structure
    server_addr     resb 16

section .text
    global main
    
    ; External functions (implemented in C or other ASM files)
    extern create_server_socket
    extern bind_server_socket
    extern listen_server_socket
    extern accept_client_connection
    extern handle_http_request
    extern close_socket
    extern print_string
    extern setup_signal_handlers

main:
    ; Print startup message
    mov rdi, startup_msg
    mov rsi, startup_len
    call print_string
    
    ; Setup signal handlers for graceful shutdown
    call setup_signal_handlers
    
    ; Create server socket
    mov rdi, server_host
    mov rsi, [server_port]
    call create_server_socket
    test rax, rax
    js .error_exit
    mov [server_socket], rax
    
    ; Bind socket to address
    mov rdi, [server_socket]
    mov rsi, server_host
    mov rdx, [server_port]
    call bind_server_socket
    test rax, rax
    js .error_exit
    
    ; Start listening for connections
    mov rdi, [server_socket]
    mov rsi, 128  ; backlog
    call listen_server_socket
    test rax, rax
    js .error_exit
    
    ; Main server loop
.server_loop:
    ; Accept client connection
    mov rdi, [server_socket]
    call accept_client_connection
    test rax, rax
    js .server_loop  ; Continue on error
    mov [client_socket], rax
    
    ; Handle the HTTP request
    mov rdi, [client_socket]
    mov rsi, request_buffer
    mov rdx, 8192
    call handle_http_request
    
    ; Close client connection
    mov rdi, [client_socket]
    call close_socket
    
    ; Continue serving
    jmp .server_loop

.error_exit:
    ; Print error message
    mov rdi, error_msg
    mov rsi, error_len
    call print_string
    
    ; Close server socket if it was created
    cmp qword [server_socket], 0
    je .exit
    mov rdi, [server_socket]
    call close_socket

.exit:
    ; Print shutdown message
    mov rdi, shutdown_msg
    mov rsi, shutdown_len
    call print_string
    
    ; Return from main
    mov rax, 0      ; return 0
    ret

; Signal handler for graceful shutdown
global signal_handler
signal_handler:
    ; Save registers
    push rax
    push rdi
    push rsi
    
    ; Print shutdown message
    mov rdi, shutdown_msg
    mov rsi, shutdown_len
    call print_string
    
    ; Close server socket
    cmp qword [server_socket], 0
    je .exit_handler
    mov rdi, [server_socket]
    call close_socket
    
.exit_handler:
    ; Restore registers
    pop rsi
    pop rdi
    pop rax
    
    ; Return from signal handler
    mov rax, 0      ; return 0
    ret
