#!/bin/bash

# Exit on any error
set -e

echo "Starting Bolt.DIY update process..."

# Get the current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Store current version
CURRENT_VERSION=$(cat "$PROJECT_ROOT/package.json" | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[[:space:]]')

echo "Current version: $CURRENT_VERSION"
echo "Fetching latest version..."

# Create temp directory
TMP_DIR=$(mktemp -d)
cd "$TMP_DIR"

# Download latest release
LATEST_RELEASE_URL=$(curl -s https://api.github.com/repos/stackblitz-labs/bolt.diy/releases/latest | grep "browser_download_url.*zip" | cut -d : -f 2,3 | tr -d \")
if [ -z "$LATEST_RELEASE_URL" ]; then
    echo "Error: Could not find latest release download URL"
    exit 1
fi

echo "Downloading latest release..."
curl -L -o latest.zip "$LATEST_RELEASE_URL"

echo "Extracting update..."
unzip -q latest.zip

# Backup current installation
echo "Creating backup..."
BACKUP_DIR="$PROJECT_ROOT/backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r "$PROJECT_ROOT"/* "$BACKUP_DIR/"

# Install update
echo "Installing update..."
cp -r ./* "$PROJECT_ROOT/"

# Clean up
cd "$PROJECT_ROOT"
rm -rf "$TMP_DIR"

echo "Update completed successfully!"
echo "Please restart the application to apply the changes."

exit 0
