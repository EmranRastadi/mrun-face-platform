.PHONY: install dev build test lint format proto clean up down deploy

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

up-vector:
	docker compose --profile vector up -d

down:
	docker compose down -v

deploy:
	skaffold run -p prod
