#!/bin/sh
set -e

# Configure mc client to interact with the MinIO server
# Use the environment variables passed from docker-compose.yml
/usr/bin/mc alias set local http://${MINIO_ENDPOINT} ${MINIO_ACCESS_KEY} ${MINIO_SECRET_KEY}

# Create the bucket if it doesn't exist
/usr/bin/mc mb local/${MINIO_BUCKET_NAME} || true

# Removed the incorrect CORS policy application command.
# CORS is now handled by mounting cors.json directly into the MinIO server's config.

echo "MinIO setup completed successfully."