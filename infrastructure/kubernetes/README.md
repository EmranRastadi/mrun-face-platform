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
- kube-prometheus-stack (Helm) - Prometheus Operator, Prometheus, kube-state-metrics, node-exporter
- Grafana - dashboards for metrics (Prometheus), logs (Loki) and traces (Tempo)
- Loki - log store, fed by the Fluent Bit DaemonSet
- Tempo - trace store (OTLP gRPC `4317`, HTTP `4318`)
- Fluent Bit - tails `/var/log/containers/*.log` on every node and ships JSON logs to Loki

Install everything with:

```bash
make monitoring
# or
./infrastructure/scripts/install-monitoring.sh
```

After that, app-level `ServiceMonitor` objects are applied together with the apps
(`kubectl apply -k infrastructure/apps`).

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