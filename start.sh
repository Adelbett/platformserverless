#!/bin/bash

# Function to handle cleanup
cleanup() {
    echo "Stopping all services..."
    kill $(jobs -p) 2>/dev/null
}

trap cleanup EXIT INT TERM

# Start Backend API
echo "Starting Spring Boot Backend..."
cd backend-api
if [ -f mvnw ]; then
    ./mvnw spring-boot:run &
else
    mvn spring-boot:run &
fi
BACKEND_PID=$!

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
wait $BACKEND_PID $WP_PID
