#!/usr/bin/env bash
set -euo pipefail

# Deployment script for mrun-face-platform
# Usage: ./deploy.sh [environment]

ENVIRONMENT="${1:-development}"

echo "Deploying mrun-face-platform to ${ENVIRONMENT} environment..."

# Build Docker images
echo "Building Docker images..."
pnpm install:all

# Monitoring platform (Helm) is separate from the kustomize-applied workloads.
if ! helm status kube-prometheus-stack -n mrun-monitoring >/dev/null 2>&1; then
  echo "Installing monitoring stack..."
  ./install-monitoring.sh
fi

# Apply Kubernetes manifests
echo "Applying Kubernetes manifests..."
cd infrastructure
kustomize build . | kubectl apply -f -

echo "Deployment complete."
