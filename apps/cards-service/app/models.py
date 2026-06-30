from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class ServiceInfo(BaseModel):
    name: str
    version: str
    environment: str
    host: Optional[str] = None
    port: Optional[int] = None
    tags: List[str] = []
    started_at: datetime = datetime.utcnow()

class HealthStatus(BaseModel):
    service: str
    status: str
    version: str
    uptime: float
    checks: Dict[str, bool]

class ServiceResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict] = None
    service: str
    version: str
    timestamp: datetime = datetime.utcnow()

class Card(BaseModel):
    id: Optional[int] = None
    title: str
    description: Optional[str] = None
    status: str = "active"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None