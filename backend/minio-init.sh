#!/bin/sh
set -e

# Configure mc client to interact with the MinIO server that will start
# Use the default MinIO root user and password
/usr/bin/mc alias set local http://localhost:9000 minioadmin minioadmin

# Create the bucket if it doesn't exist
# The '|| true' prevents the script from exiting if the bucket already exists
/usr/bin/mc mb local/journey-images || true

# Apply the CORS policy to the bucket
# Using 'mc anonymous set-json' as suggested by the error message
/usr/bin/mc anonymous set-json /tmp/cors-policy.json local/journey-images

# Execute the original MinIO server command
# This ensures MinIO starts after setup is complete
exec /usr/bin/minio server /data --console-address ":9001"