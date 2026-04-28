#!/bin/bash
# Usage: ./build-and-push.sh TON_USERNAME
# Example: ./build-and-push.sh mohamedali97

USERNAME=${1:-"adelbettaieb"}

echo "Building order-service..."
cd order-service
docker build -t $USERNAME/order-service:latest .
docker push $USERNAME/order-service:latest
cd ..

echo "Building notification-service..."
cd notification-service
docker build -t $USERNAME/notification-service:latest .
docker push $USERNAME/notification-service:latest
cd ..

echo ""
echo "Done! Images pushed:"
echo "  $USERNAME/order-service:latest"
echo "  $USERNAME/notification-service:latest"
