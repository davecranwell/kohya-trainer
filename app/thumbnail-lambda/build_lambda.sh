#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Remove existing node_modules and package-lock.json
rm -rf node_modules

# Perform a fresh npm installation
npm ci

# Create the zip archive
zip -r thumbnailer_archive.zip . -x "*.git*" "*.zip"

echo "Lambda package created successfully: thumbnailer_archive.zip"