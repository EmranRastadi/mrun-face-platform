#!/usr/bin/env bash
set -euo pipefail

# Deployment script for mrun-face-platform
# Usage: ./deploy.sh [environment]

ENVIRONMENT="${1:-development}"

echo "Deploying mrun-face-platform to ${ENVIRONMENT} environment..."

# Build Docker images
echo "Building Docker images..."
pnpm install:all

# Apply Kubernetes manifests
echo "Applying Kubernetes manifests..."
cd infrastructure
kustomize build . | kubectl apply -f -

echo "Deployment complete."