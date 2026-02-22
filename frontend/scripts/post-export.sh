#!/bin/bash
# Post-export script to add PWA meta tags and copy icons

# Copy icons to dist
mkdir -p /app/frontend/dist/icons
cp /app/frontend/public/icons/* /app/frontend/dist/icons/ 2>/dev/null || true
cp /app/frontend/assets/images/icon-192.png /app/frontend/dist/icons/ 2>/dev/null || true
cp /app/frontend/assets/images/icon-512.png /app/frontend/dist/icons/ 2>/dev/null || true
cp /app/frontend/assets/images/apple-touch-icon.png /app/frontend/dist/icons/ 2>/dev/null || true

# Copy manifest and service worker
cp /app/frontend/public/manifest.json /app/frontend/dist/ 2>/dev/null || true
cp /app/frontend/public/sw.js /app/frontend/dist/ 2>/dev/null || true

# Add PWA meta tags to index.html
sed -i 's|<link rel="icon" href="/favicon.ico" />|<link rel="icon" href="/favicon.ico" /><link rel="manifest" href="/manifest.json" /><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" /><link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" /><link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" /><meta name="apple-mobile-web-app-capable" content="yes" /><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" /><meta name="apple-mobile-web-app-title" content="DanoFitness" /><meta name="theme-color" content="#FF6B35" />|' /app/frontend/dist/index.html

echo "PWA assets added to dist/"
