# Makefile for Assembly HTTP Server
# Target: x86_64 Linux

ASM = nasm
CC = gcc
LD = ld

# Directories
SRC_DIR = src
OBJ_DIR = obj
BIN_DIR = bin

# Assembly source files (exclude main.asm, use main_c.c instead)
ASM_SOURCES = $(filter-out $(SRC_DIR)/main.asm, $(wildcard $(SRC_DIR)/*.asm))
ASM_OBJECTS = $(ASM_SOURCES:$(SRC_DIR)/%.asm=$(OBJ_DIR)/%.o)

# C source files (for system calls and library functions)
C_SOURCES = $(wildcard $(SRC_DIR)/*.c)
C_OBJECTS = $(C_SOURCES:$(SRC_DIR)/%.c=$(OBJ_DIR)/%.o)

# All object files
OBJECTS = $(ASM_OBJECTS) $(C_OBJECTS)

# Target executable
TARGET = $(BIN_DIR)/call-system-server

# Assembly flags
ASMFLAGS = -f elf64 -g -F dwarf

# C flags
CFLAGS = -Wall -Wextra -std=c11 -g -O2 -fno-stack-protector -no-pie

# Linker flags
LDFLAGS = -lssl -lcrypto -lpthread

# Default target
all: directories $(TARGET)

# Create directories
directories:
	@mkdir -p $(OBJ_DIR) $(BIN_DIR)

# Link the executable
$(TARGET): $(OBJECTS)
	$(CC) -no-pie -o $@ $^ $(LDFLAGS)

# Compile assembly files
$(OBJ_DIR)/%.o: $(SRC_DIR)/%.asm
	$(ASM) $(ASMFLAGS) -o $@ $<

# Compile C files
$(OBJ_DIR)/%.o: $(SRC_DIR)/%.c
	$(CC) $(CFLAGS) -c -o $@ $<

# Clean build artifacts
clean:
	rm -rf $(OBJ_DIR) $(BIN_DIR)

# Debug target
debug: CFLAGS += -DDEBUG -g3
debug: ASMFLAGS += -g
debug: all

# Performance target
performance: CFLAGS += -O3 -DNDEBUG -march=native
performance: LDFLAGS = -lssl -lcrypto -lpthread -s
performance: all

# Install target
install: $(TARGET)
	cp $(TARGET) /usr/local/bin/

# Uninstall target
uninstall:
	rm -f /usr/local/bin/call-system-server

# Run the server
run: $(TARGET)
	./$(TARGET)

# Run with debugging
run-debug: debug
	gdb ./$(TARGET)

# Run with valgrind
run-valgrind: debug
	valgrind --leak-check=full --show-leak-kinds=all ./$(TARGET)

# Run with strace
run-strace: $(TARGET)
	strace -f ./$(TARGET)

# Test target
test: $(TARGET)
	@echo "Running basic HTTP tests..."
	@./tests/run_tests.sh

.PHONY: all directories clean debug performance install uninstall run run-debug run-valgrind run-strace test
