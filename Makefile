.PHONY: install dev build test lint format proto clean up down deploy monitoring monitoring-uninstall webrtc-up webrtc-down webrtc-logs webrtc-status webrtc-stun-check

install:
	pnpm install

dev:
	pnpm dev

build:
	pnpm build

test:
	pnpm test

lint:
	pnpm lint

format:
	pnpm format

proto:
	buf lint && buf generate

clean:
	pnpm clean

# Local infra (Postgres/Kafka/Consul/...) — see docker-compose.yml
# Default `up` starts the core stack (Milvus/etcd are opt-in via the `vector` profile).
up:
	docker compose up -d

# Observability platform (kube-prometheus-stack + Grafana/Loki/Tempo/Fluent Bit).
monitoring:
	./infrastructure/scripts/install-monitoring.sh

monitoring-uninstall:
	helm uninstall kube-prometheus-stack -n mrun-monitoring || true

up-vector:
	docker compose --profile vector up -d

# WebRTC ICE: coturn STUN/TURN (profile "webrtc" keeps it optional).
webrtc-up:
	docker compose --profile webrtc up -d coturn

webrtc-down:
	docker compose --profile webrtc stop coturn

webrtc-logs:
	docker compose --profile webrtc logs -f coturn

webrtc-status:
	docker compose --profile webrtc ps coturn

# Real STUN binding from inside the coturn container (not just a port check).
webrtc-stun-check:
	docker compose --profile webrtc exec -T coturn turnutils_stunclient -p 3478 127.0.0.1

down:
	docker compose down -v

deploy:
	skaffold run -p prod
