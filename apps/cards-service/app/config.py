from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    service_name: str = "mrun-cards"
    service_version: str = "1.0.0"
    environment: str = "development"

    consul_enabled: bool = False
    consul_host: str = "localhost"
    consul_port: int = 8500

    class Config:
        env_file = ".env"


settings = Settings()