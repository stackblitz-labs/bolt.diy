#!/bin/bash

# Set working directory
cd /root/bolt

# Kill any existing processes on port 5173
lsof -ti:5173 | xargs -r kill -9 2>/dev/null

# Set environment variables
export NODE_OPTIONS="--max-old-space-size=3482"
export HOST=0.0.0.0
export PORT=5173
# Don't set NODE_ENV for dev server
unset NODE_ENV

echo "Starting Bolt.gives Server..."
echo "========================================="
echo "Version: 3.0.1"
echo "Port: 5173"
echo "Host: 0.0.0.0"
echo "URL: https://bolt.openweb.live"
echo "========================================="

# Use dev server with fixed dependencies
exec pnpm run dev --host 0.0.0.0 --port 5173