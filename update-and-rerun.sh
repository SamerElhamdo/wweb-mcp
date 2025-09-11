#!/bin/bash

# Script to update Docker image and restart container
# Usage: ./update-and-rerun.sh

git pull

set -e  # Exit on any error

echo "🚀 Starting Docker update and restart process..."

# Container name
CONTAINER_NAME="wweb-mcp-sse"
IMAGE_NAME="wweb-mcp:latest"

echo "📦 Stopping container: $CONTAINER_NAME"
docker stop $CONTAINER_NAME || echo "Container $CONTAINER_NAME was not running"

echo "🗑️  Removing container: $CONTAINER_NAME"
docker rm -f $CONTAINER_NAME || echo "Container $CONTAINER_NAME was not found"

echo "🔨 Building new image: $IMAGE_NAME"
docker build . -t $IMAGE_NAME

echo "✅ Build completed successfully!"

echo "🚀 Starting new container: $CONTAINER_NAME"
docker run -d \
  -p 3002:3002 \
  -v ~/wweb-auth:/app/auth_data \
  --name $CONTAINER_NAME \
  $IMAGE_NAME \
  --mode mcp \
  --mcp-mode standalone \
  --transport sse \
  --sse-port 3002 \
  --auth-data-path /app/auth_data \
  --auth-strategy local

echo "✅ Container started successfully!"
echo ""
echo "📊 Container status:"
docker ps | grep $CONTAINER_NAME || echo "Container not found in running containers"
echo ""
echo "📝 To view logs:"
echo "docker logs -f $CONTAINER_NAME"
