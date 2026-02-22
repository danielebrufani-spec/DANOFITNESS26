#!/bin/bash
# Script per avviare il server in modo stabile

echo "[STABLE SERVER] Starting..."

# Kill any existing serve process
pkill -f "serve dist" 2>/dev/null || true

# Make sure we have the latest build
cd /app/frontend

# Check if dist exists
if [ ! -d "dist" ]; then
    echo "[STABLE SERVER] Building app..."
    npx expo export -p web --clear
    bash /app/frontend/scripts/post-export.sh
fi

# Start the server in the background with restart on failure
while true; do
    echo "[STABLE SERVER] Starting serve on port 3000..."
    npx serve dist -l 3000 -s
    
    echo "[STABLE SERVER] Server stopped, restarting in 3 seconds..."
    sleep 3
done
