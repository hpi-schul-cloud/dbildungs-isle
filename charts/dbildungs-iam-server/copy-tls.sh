#!/bin/bash

STAGING_DIR="/staging"
MOUNTED_FILES_DIR="/tls"
CONFIG_DIR="/data/tls"

# Create the directories
mkdir -p "$STAGING_DIR"
mkdir -p "$CONFIG_DIR"

# Check if the TLS files are already generated
if [ ! -f "$MOUNTED_FILES_DIR/ca.crt" ] || [ ! -f "$MOUNTED_FILES_DIR/redis.crt" ] || [ ! -f "$MOUNTED_FILES_DIR/redis.key" ]; then
  echo "Generating TLS certificates using gencert.sh..."
  cp -v "$MOUNTED_FILES_DIR/gencert.sh" "$STAGING_DIR"
  pushd "$STAGING_DIR" || exit 1
  chmod +x gencert.sh
  ./gencert.sh
  popd || exit 1
fi

# Copy the TLS files to the staging directory
echo "Copying TLS files to staging directory..."
cp -v "$MOUNTED_FILES_DIR/ca.crt" "$MOUNTED_FILES_DIR/redis.crt" "$MOUNTED_FILES_DIR/redis.key" "$STAGING_DIR"

# Change to the staging directory
echo "Changing to staging directory..."
pushd "$STAGING_DIR" || exit 1

# Copy the generated certificates to the config directory
echo "Copying certificates to config directory..."
cp -v ca.crt redis.crt redis.key "$CONFIG_DIR"

# Copy the pre-made Redis configuration file to the config directory
echo "Copying Redis configuration file to config directory..."
cp -v "$MOUNTED_FILES_DIR/redis.conf" "$CONFIG_DIR"

# Change back to the previous directory
echo "Changing back to previous directory..."
popd || exit 1

# Remove the staging directory
echo "Removing staging directory..."
rm -rf "$STAGING_DIR"