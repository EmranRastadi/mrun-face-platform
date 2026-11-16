"""Camera-service configuration (pydantic-settings)."""

from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    service_name: str = "camera-service"
    service_version: str = "0.2.0"
    environment: str = "development"
    port: int = 8002
    log_level: str = "INFO"

    # Default camera (auto-registered on startup if CAMERA_RTSP_URL is set).
    camera_rtsp_url: str = ""
    camera_name: str = "default-camera"
    camera_organization_id: str = ""
    sample_fps: float = 1.0
    frame_dir: str = "/tmp/camera-frames"

    # Kafka (optional; events are logged when disabled).
    kafka_enabled: bool = False
    kafka_brokers: str = "localhost:9092"
    kafka_topic: str = "vision.events"

    # MinIO (optional; frames are kept on disk when disabled).
    minio_enabled: bool = False
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "camera-frames"
    minio_secure: bool = False

    consul_enabled: bool = False
    consul_host: str = "localhost"
    consul_port: int = 8500

    class Config:
        env_file = ".env"
        extra = "ignore"
        case_sensitive = False


settings = Settings()
