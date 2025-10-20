#!/bin/sh

# Start MinIO server in the background
minio server /data --console-address ':9001' &
MINIO_PID=$!

# Wait for MinIO server to be ready
echo "Waiting for MinIO server to start..."
# Removed --timeout 30s as it's not supported by 'mc ready'
/usr/bin/mc ready local 
if [ $? -ne 0 ]; then
  echo "MinIO server did not start in time. Exiting."
  kill $MINIO_PID
  exit 1
fi
echo "MinIO server is ready."

# Add MinIO host to mc config
/usr/bin/mc config host add local http://localhost:9000 minioadmin minioadmin

# Apply CORS policy
/usr/bin/mc policy set-json /tmp/cors-policy.json local/journey-images

# Wait for the background MinIO server process to finish (it should run indefinitely)
wait $MINIO_PID