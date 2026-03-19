#!/bin/bash

# setup-minio.sh
# Initialize Minio bucket and lifecycle policy for EasyDeploy

set -e

echo "🔧 Setting up Minio for EasyDeploy..."

# Wait for Minio to be ready
echo "⏳ Waiting for Minio to be ready..."
until docker exec kids-html-minio mc alias set local http://localhost:9000 minioadmin minioadmin 2>/dev/null; do
  echo "   Waiting for Minio..."
  sleep 2
done

echo "✅ Minio is ready!"

# Create bucket
echo "📦 Creating bucket 'kids-html'..."
docker exec kids-html-minio mc mb local/kids-html --ignore-existing

# Set public read policy for the bucket
echo "🔓 Setting public read policy..."
docker exec kids-html-minio mc anonymous set download local/kids-html

# Create lifecycle policy (auto-delete after 30 days)
echo "⏰ Setting up 30-day auto-deletion policy..."
docker exec kids-html-minio mc ilm add local/kids-html --expiry-days 30

echo "✅ Minio setup complete!"
echo ""
echo "📊 Bucket info:"
docker exec kids-html-minio mc ls local/

echo ""
echo "🎉 Ready to deploy! Backend is at http://localhost:3000"
