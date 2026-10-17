#!/usr/bin/env bash
set -euo pipefail

# Seed script for mrun-face-platform
# Usage: ./seed.sh [environment]

ENVIRONMENT="${1:-development}"

echo "Seeding data for ${ENVIRONMENT} environment..."

# Seed initial data based on environment
case "${ENVIRONMENT}" in
  development)
    echo "Seeding development data..."
    # Add development seed data commands here
    ;;
  production)
    echo "Seeding production data..."
    # Add production seed data commands here
    ;;
  *)
    echo "Unknown environment: ${ENVIRONMENT}"
    exit 1
    ;;
esac

echo "Seeding complete."