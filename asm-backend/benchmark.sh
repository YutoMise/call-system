#!/bin/bash

# Performance benchmark script for Assembly HTTP Server
# Compares performance with Node.js version

set -e

echo "=== Assembly HTTP Server Performance Benchmark ==="

# Configuration
ASM_SERVER="./bin/call-system-server"
NODE_SERVER="../index.js"
TEST_PORT=3003
REQUESTS=1000
CONCURRENCY=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to wait for server to start
wait_for_server() {
    local port=$1
    local timeout=30
    local count=0
    
    echo "Waiting for server to start on port $port..."
    while ! nc -z localhost $port 2>/dev/null; do
        sleep 1
        count=$((count + 1))
        if [ $count -ge $timeout ]; then
            echo -e "${RED}Timeout waiting for server to start${NC}"
            return 1
        fi
    done
    echo -e "${GREEN}Server is ready${NC}"
    return 0
}

# Function to kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port)
    if [ ! -z "$pid" ]; then
        echo "Killing process $pid on port $port"
        kill -9 $pid 2>/dev/null || true
        sleep 2
    fi
}

# Function to run performance test
run_performance_test() {
    local server_name=$1
    local url=$2
    
    echo -e "${YELLOW}Testing $server_name...${NC}"
    
    # Basic HTTP test
    echo "1. Basic HTTP GET test:"
    ab -n $REQUESTS -c $CONCURRENCY -q "$url/" > /tmp/ab_basic.txt 2>&1
    
    local rps=$(grep "Requests per second" /tmp/ab_basic.txt | awk '{print $4}')
    local time_per_req=$(grep "Time per request.*mean" /tmp/ab_basic.txt | head -1 | awk '{print $4}')
    local failed=$(grep "Failed requests" /tmp/ab_basic.txt | awk '{print $3}')
    
    echo "  - Requests per second: $rps"
    echo "  - Time per request: ${time_per_req}ms"
    echo "  - Failed requests: $failed"
    
    # API endpoint test
    echo "2. API endpoint test (/api/channels):"
    ab -n $((REQUESTS/2)) -c $CONCURRENCY -q "$url/api/channels" > /tmp/ab_api.txt 2>&1
    
    local api_rps=$(grep "Requests per second" /tmp/ab_api.txt | awk '{print $4}')
    local api_time=$(grep "Time per request.*mean" /tmp/ab_api.txt | head -1 | awk '{print $4}')
    local api_failed=$(grep "Failed requests" /tmp/ab_api.txt | awk '{print $3}')
    
    echo "  - Requests per second: $api_rps"
    echo "  - Time per request: ${api_time}ms"
    echo "  - Failed requests: $api_failed"
    
    # Memory usage test
    echo "3. Memory usage:"
    local pid=$(lsof -ti:$TEST_PORT)
    if [ ! -z "$pid" ]; then
        local memory=$(ps -o pid,vsz,rss,comm -p $pid | tail -1)
        echo "  - Process info: $memory"
        local rss=$(echo $memory | awk '{print $3}')
        echo "  - RSS Memory: ${rss}KB"
    fi
    
    echo ""
    
    # Store results for comparison
    echo "$server_name,$rps,$time_per_req,$failed,$api_rps,$api_time,$api_failed,$rss" >> /tmp/benchmark_results.csv
}

# Function to test Assembly server
test_assembly_server() {
    echo -e "${GREEN}=== Testing Assembly HTTP Server ===${NC}"
    
    # Kill any existing process on the port
    kill_port $TEST_PORT
    
    # Start Assembly server
    echo "Starting Assembly server..."
    $ASM_SERVER &
    local server_pid=$!
    
    # Wait for server to start
    if wait_for_server $TEST_PORT; then
        run_performance_test "Assembly Server" "http://localhost:$TEST_PORT"
        
        # Test specific Assembly features
        echo "4. Assembly-specific tests:"
        
        # Test concurrent connections
        echo "  - Concurrent connection test:"
        ab -n 100 -c 50 -q "http://localhost:$TEST_PORT/" > /tmp/ab_concurrent.txt 2>&1
        local concurrent_rps=$(grep "Requests per second" /tmp/ab_concurrent.txt | awk '{print $4}')
        echo "    Concurrent RPS: $concurrent_rps"
        
        # Test keep-alive
        echo "  - Keep-alive test:"
        ab -n 100 -c 10 -k -q "http://localhost:$TEST_PORT/" > /tmp/ab_keepalive.txt 2>&1
        local keepalive_rps=$(grep "Requests per second" /tmp/ab_keepalive.txt | awk '{print $4}')
        echo "    Keep-alive RPS: $keepalive_rps"
        
    else
        echo -e "${RED}Failed to start Assembly server${NC}"
    fi
    
    # Clean up
    kill $server_pid 2>/dev/null || true
    kill_port $TEST_PORT
}

# Function to test Node.js server (for comparison)
test_nodejs_server() {
    echo -e "${GREEN}=== Testing Node.js Server (for comparison) ===${NC}"
    
    if [ ! -f "$NODE_SERVER" ]; then
        echo -e "${YELLOW}Node.js server not found, skipping comparison${NC}"
        return
    fi
    
    # Kill any existing process on the port
    kill_port $TEST_PORT
    
    # Start Node.js server
    echo "Starting Node.js server..."
    cd .. && node index.js &
    local server_pid=$!
    cd asm-backend
    
    # Wait for server to start
    if wait_for_server $TEST_PORT; then
        run_performance_test "Node.js Server" "http://localhost:$TEST_PORT"
    else
        echo -e "${RED}Failed to start Node.js server${NC}"
    fi
    
    # Clean up
    kill $server_pid 2>/dev/null || true
    kill_port $TEST_PORT
}

# Function to generate report
generate_report() {
    echo -e "${GREEN}=== Performance Comparison Report ===${NC}"
    
    if [ -f /tmp/benchmark_results.csv ]; then
        echo "Server,Basic RPS,Basic Time(ms),Basic Failed,API RPS,API Time(ms),API Failed,Memory(KB)"
        cat /tmp/benchmark_results.csv
        echo ""
        
        # Calculate improvements
        if [ $(wc -l < /tmp/benchmark_results.csv) -eq 2 ]; then
            local asm_rps=$(head -1 /tmp/benchmark_results.csv | cut -d',' -f2)
            local node_rps=$(tail -1 /tmp/benchmark_results.csv | cut -d',' -f2)
            
            if [ ! -z "$asm_rps" ] && [ ! -z "$node_rps" ] && [ "$node_rps" != "0" ]; then
                local improvement=$(echo "scale=2; ($asm_rps - $node_rps) / $node_rps * 100" | bc -l)
                echo -e "${GREEN}Performance improvement: ${improvement}%${NC}"
            fi
        fi
    fi
}

# Main execution
main() {
    # Check dependencies
    if ! command -v ab &> /dev/null; then
        echo -e "${RED}Apache Bench (ab) is required but not installed${NC}"
        echo "Install with: sudo apt-get install apache2-utils"
        exit 1
    fi
    
    if ! command -v nc &> /dev/null; then
        echo -e "${RED}netcat (nc) is required but not installed${NC}"
        echo "Install with: sudo apt-get install netcat"
        exit 1
    fi
    
    # Initialize results file
    echo "Server,Basic RPS,Basic Time(ms),Basic Failed,API RPS,API Time(ms),API Failed,Memory(KB)" > /tmp/benchmark_results.csv
    
    # Run tests
    test_assembly_server
    sleep 2
    test_nodejs_server
    
    # Generate report
    generate_report
    
    # Cleanup
    rm -f /tmp/ab_*.txt /tmp/benchmark_results.csv
    
    echo -e "${GREEN}Benchmark completed!${NC}"
}

# Run main function
main "$@"
