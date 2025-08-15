; socket.asm - Socket operations for HTTP server
; Target: x86_64 Linux

section .data
    ; Socket constants
    AF_INET         equ 2
    SOCK_STREAM     equ 1
    IPPROTO_TCP     equ 6
    SOL_SOCKET      equ 1
    SO_REUSEADDR    equ 2
    INADDR_ANY      equ 0
    
    ; Error messages
    socket_error    db "Failed to create socket", 10, 0
    bind_error      db "Failed to bind socket", 10, 0
    listen_error    db "Failed to listen on socket", 10, 0
    accept_error    db "Failed to accept connection", 10, 0

section .bss
    sockaddr_in     resb 16  ; struct sockaddr_in
    socklen         resq 1

section .text
    global create_server_socket
    global bind_server_socket
    global listen_server_socket
    global accept_client_connection
    global close_socket
    extern print_string

; Create a TCP socket
; Input: rdi = host string, rsi = port
; Output: rax = socket fd (negative on error)
create_server_socket:
    push rbp
    mov rbp, rsp
    push rdi
    push rsi
    
    ; Create socket: socket(AF_INET, SOCK_STREAM, IPPROTO_TCP)
    mov rax, 41         ; sys_socket
    mov rdi, AF_INET    ; domain
    mov rsi, SOCK_STREAM ; type
    mov rdx, IPPROTO_TCP ; protocol
    syscall
    
    ; Check for error
    test rax, rax
    js .error
    
    push rax  ; Save socket fd
    
    ; Set SO_REUSEADDR option
    mov rdi, rax        ; socket fd
    mov rax, 54         ; sys_setsockopt
    mov rsi, SOL_SOCKET ; level
    mov rdx, SO_REUSEADDR ; optname
    mov r10, 1          ; optval (1 = enable)
    push r10
    mov r10, rsp        ; optval pointer
    mov r8, 4           ; optlen
    syscall
    pop r10             ; Clean stack
    
    pop rax             ; Restore socket fd
    jmp .success

.error:
    mov rdi, socket_error
    mov rsi, 22
    call print_string
    mov rax, -1

.success:
    pop rsi
    pop rdi
    mov rsp, rbp
    pop rbp
    ret

; Bind socket to address and port
; Input: rdi = socket fd, rsi = host string, rdx = port
; Output: rax = 0 on success, negative on error
bind_server_socket:
    push rbp
    mov rbp, rsp
    push rdi
    push rsi
    push rdx
    
    ; Prepare sockaddr_in structure
    mov word [sockaddr_in], AF_INET     ; sin_family
    
    ; Convert port to network byte order (big endian)
    mov ax, dx
    xchg al, ah
    mov word [sockaddr_in + 2], ax      ; sin_port
    
    ; Set address to INADDR_ANY (0.0.0.0)
    mov dword [sockaddr_in + 4], INADDR_ANY  ; sin_addr
    
    ; Zero out sin_zero
    mov qword [sockaddr_in + 8], 0
    
    ; Bind socket
    mov rax, 49         ; sys_bind
    mov rdi, [rsp + 16] ; socket fd
    mov rsi, sockaddr_in ; addr
    mov rdx, 16         ; addrlen
    syscall
    
    ; Check for error
    test rax, rax
    js .error
    jmp .success

.error:
    mov rdi, bind_error
    mov rsi, 20
    call print_string
    mov rax, -1

.success:
    pop rdx
    pop rsi
    pop rdi
    mov rsp, rbp
    pop rbp
    ret

; Start listening on socket
; Input: rdi = socket fd, rsi = backlog
; Output: rax = 0 on success, negative on error
listen_server_socket:
    push rbp
    mov rbp, rsp
    
    ; Listen on socket
    mov rax, 50         ; sys_listen
    ; rdi already contains socket fd
    ; rsi already contains backlog
    syscall
    
    ; Check for error
    test rax, rax
    js .error
    jmp .success

.error:
    mov rdi, listen_error
    mov rsi, 25
    call print_string
    mov rax, -1

.success:
    mov rsp, rbp
    pop rbp
    ret

; Accept client connection
; Input: rdi = server socket fd
; Output: rax = client socket fd (negative on error)
accept_client_connection:
    push rbp
    mov rbp, rsp
    push rdi
    
    ; Accept connection
    mov rax, 43         ; sys_accept
    ; rdi already contains server socket fd
    mov rsi, 0          ; addr (NULL - we don't need client info)
    mov rdx, 0          ; addrlen (NULL)
    syscall
    
    ; Check for error
    test rax, rax
    js .error
    jmp .success

.error:
    ; Don't print error for accept - it's common during shutdown
    mov rax, -1

.success:
    pop rdi
    mov rsp, rbp
    pop rbp
    ret

; Close socket
; Input: rdi = socket fd
; Output: rax = 0 on success, negative on error
close_socket:
    push rbp
    mov rbp, rsp
    
    ; Close socket
    mov rax, 3          ; sys_close
    ; rdi already contains socket fd
    syscall
    
    mov rsp, rbp
    pop rbp
    ret
