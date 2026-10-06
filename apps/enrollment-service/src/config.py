from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    service_name: str = "enrollment-service"
    service_version: str = "1.0.0"
    environment: str = "development"
    port: int = 8001
    log_level: str = "INFO"

    consul_enabled: bool = False
    consul_host: str = "localhost"
    consul_port: int = 8500

    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = "postgres"
    db_password: str = "postgres"
    db_name: str = "enrollment"

    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "enroll"
    minio_secure: bool = False

    milvus_host: str = "localhost"
    milvus_port: int = 19530
    milvus_collection: str = "face_embeddings"
    milvus_dimension: int = 512

    kafka_brokers: str = "localhost:9092"
    kafka_enabled: bool = False

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
