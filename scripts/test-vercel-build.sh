#!/bin/bash

# Test Vercel build locally
echo "Testing Vercel build process locally..."

# Set environment variables that Vercel sets
export CI=true
export VERCEL=1

# Clean up
echo "Cleaning up..."
rm -rf node_modules
rm -rf apps/web/node_modules
rm -rf apps/web/.next
rm -rf packages/*/node_modules

# Install dependencies
echo "Installing dependencies..."
npm install

# Build
echo "Building..."
npm run build -- --filter=@policydiff/web

echo "Build complete!"