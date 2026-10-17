"""Domain models (Pydantic) for enrollment-service."""

from datetime import datetime

from pydantic import BaseModel, Field


class HealthStatus(BaseModel):
    service: str
    status: str
    version: str
    uptime: float
    checks: dict[str, bool] = Field(default_factory=dict)


class ServiceResponse(BaseModel):
    success: bool
    message: str
    data: dict | list | None = None
    service: str
    version: str


class Person(BaseModel):
    id: str
    full_name: str
    card_id: str | None = None
    image_key: str | None = None
    embedding_id: str | None = None
    created_at: datetime | None = None


class EnrollmentResult(BaseModel):
    person_id: str
    card_id: str
    image_key: str
    embedding_id: str
    enrolled_at: datetime
