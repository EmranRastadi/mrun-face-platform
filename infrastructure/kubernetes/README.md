# Kubernetes Infrastructure

This directory contains Kubernetes manifests and kustomize configurations for the mrun-face-platform.

## Directory Structure

- `infrastructure/` - Root kustomize configuration and bootstrap
- `infrastructure/apps/` - Per-service kustomizations
- `infrastructure/platform/` - Platform-level kustomizations (databases, networking, monitoring, etc.)
- `infrastructure/kubernetes/` - Kubernetes overlays for different environments
  - `overlays/dev/` - Development overlay with patches

## Key Components

### External Services
- Kafka - distributed streaming platform
- PostgreSQL - relational database
- MinIO - object storage
- ClickHouse - analytical database
- DragonflyDB - caching layer
- Milvus - vector database

### Platform Services
- Keycloak - identity and access management
- HAProxy - load balancer
- Consul - service discovery

### Monitoring
- Grafana - visualization
- Tempo - tracing

## Usage

### Development
```bash
cd infrastructure
kustomize build overlays/dev | kubectl apply -f -
```

### Production
```bash
cd infrastructure
kustomize build . | kubectl apply -f -
```