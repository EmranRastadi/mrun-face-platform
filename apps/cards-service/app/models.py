from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ServiceResponse(BaseModel):
    success: bool
    message: str
    data: Any
    service: str
    version: str


class HealthStatus(BaseModel):
    service: str
    status: str
    version: str
    uptime: float
    checks: Dict[str, bool]


class ServiceInfo(BaseModel):
    name: str
    version: str
    environment: str
    tags: List[str]
    started_at: float


class Card(BaseModel):
    id: Optional[int] = None

    title: str
    description: Optional[str] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None