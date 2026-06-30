import os
from typing import Optional

class Settings:
    service_name: str = os.getenv("SERVICE_NAME", "user-service")
    service_version: str = os.getenv("SERVICE_VERSION", "1.0.0")
    environment: str = os.getenv("ENVIRONMENT", "development")
    
    consul_host: str = os.getenv("CONSUL_HOST", "localhost")
    consul_port: int = int(os.getenv("CONSUL_PORT", 8500))
    consul_enabled: bool = os.getenv("CONSUL_ENABLED", "true").lower() == "true"
    
    db_host: str = os.getenv("DB_HOST", "localhost")
    db_port: int = int(os.getenv("DB_PORT", 5432))
    db_user: str = os.getenv("DB_USER", "postgres")
    db_password: str = os.getenv("DB_PASSWORD", "postgres")
    db_name: str = os.getenv("DB_NAME", "mrun")
    
    @property
    def database_url(self) -> str:
        return f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"

settings = Settings()