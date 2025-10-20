#!/bin/sh
set -e

# Configure mc client to interact with the MinIO server
/usr/bin/mc alias set local http://${MINIO_ENDPOINT} ${MINIO_ACCESS_KEY} ${MINIO_SECRET_KEY}

# Create the bucket if it doesn't exist
/usr/bin/mc mb local/${MINIO_BUCKET_NAME} || true

# Apply the CORS configuration from the mounted file
/usr/bin/mc config set local bucket cors ${MINIO_BUCKET_NAME} /tmp/cors.json

echo "MinIO setup completed successfully."