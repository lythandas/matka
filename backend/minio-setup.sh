#!/bin/sh
set -e

# Configure mc client to interact with the MinIO server
# Use the environment variables passed from docker-compose.yml
/usr/bin/mc alias set local http://${MINIO_ENDPOINT} ${MINIO_ACCESS_KEY} ${MINIO_SECRET_KEY}

# Create the bucket if it doesn't exist
/usr/bin/mc mb local/${MINIO_BUCKET_NAME} || true

# Apply the CORS policy to the bucket
/usr/bin/mc anonymous set-json /tmp/cors-policy.json local/${MINIO_BUCKET_NAME}

echo "MinIO setup completed successfully."