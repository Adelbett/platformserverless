#!/bin/bash

# Function to handle cleanup
cleanup() {
    echo "Stopping all services..."
    kill $(jobs -p) 2>/dev/null
}

trap cleanup EXIT INT TERM

# Start Control Plane
echo "Starting Control Plane..."
cd control-plane
if [ ! -f go.mod ]; then
    echo "Initializing Go module..."
    go mod init control-plane
    go mod tidy
fi
go run main.go &
CP_PID=$!

# Start Web Portal
echo "Starting Web Portal..."
cd ../web-portal
if [ ! -d node_modules ]; then
    echo "Installing frontend dependencies..."
    npm install
fi
npm run dev -- --host &
WP_PID=$!

echo "Services started. Press Ctrl+C to stop."
wait $CP_PID $WP_PID
