from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    service_name: str = "mrun-cards"
    service_version: str = "1.0.0"
    environment: str = "development"

    consul_enabled: bool = False
    consul_host: str = "localhost"
    consul_port: int = 8500

    db_host: str = "postgres"
    db_port: int = 5432
    db_user: str = "postgres"
    db_password: str = "password"
    db_name: str = "cards"

    cards_rate_limit_per_minute: int = 30
    cards_dedupe_ttl_seconds: int = 300

    kafka_brokers: str = "kafka:9092"
    kafka_client_id: str = "cards-service"
    kafka_group_id: str = "cards-workers"
    kafka_enabled: bool = False

    keycloak_url: str = "http://keycloak.mrun-security.svc.cluster.local:8080"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()