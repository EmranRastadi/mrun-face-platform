from fastapi import FastAPI, HTTPException
import time
import httpx
from contextlib import asynccontextmanager
from typing import List
from datetime import datetime

from .config import settings
from .models import ServiceInfo, HealthStatus, ServiceResponse, Card
from .utils import get_logger, consul_client

logger = get_logger(__name__)
START_TIME = time.time()

# ==================== FastAPI App ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """مدیریت چرخه حیات"""
    logger.info(f"🚀 Starting {settings.service_name} v{settings.service_version}")
    
    # ثبت در Consul
    if settings.consul_enabled:
        consul_client.register_service(
            name=settings.service_name,
            port=8000,
            address="mrun-cards",
            tags=["fastapi", "cards", "v1"]
        )
    
    yield
    
    # پاکسازی
    logger.info(f"🛑 Shutting down {settings.service_name}")

app = FastAPI(
    title="MRUN Cards Service",
    version=settings.service_version,
    description="Service for managing cards",
    lifespan=lifespan
)

# ==================== API Endpoints ====================

@app.get("/")
async def root():
    return ServiceResponse(
        success=True,
        message=f"Welcome to {settings.service_name}",
        data={
            "service": settings.service_name,
            "version": settings.service_version,
            "docs": "/docs"
        },
        service=settings.service_name,
        version=settings.service_version
    )

@app.get("/health")
async def health_check():
    uptime = time.time() - START_TIME
    return HealthStatus(
        service=settings.service_name,
        status="healthy",
        version=settings.service_version,
        uptime=uptime,
        checks={
            "consul": consul_client.client is not None if settings.consul_enabled else True,
            "service": True
        }
    )

@app.get("/info")
async def service_info():
    return ServiceInfo(
        name=settings.service_name,
        version=settings.service_version,
        environment=settings.environment,
        tags=["fastapi", "cards"],
        started_at=START_TIME
    )

@app.get("/services")
async def get_all_services():
    if not settings.consul_enabled:
        raise HTTPException(status_code=503, detail="Consul is disabled")
    
    services = consul_client.get_all_services()
    return ServiceResponse(
        success=True,
        message="All services in Consul",
        data={
            "count": len(services),
            "services": list(services.keys())
        },
        service=settings.service_name,
        version=settings.service_version
    )

@app.get("/service/{service_name}")
async def get_service(service_name: str):
    if not settings.consul_enabled:
        raise HTTPException(status_code=503, detail="Consul is disabled")
    
    service = consul_client.get_service(service_name)
    if not service:
        raise HTTPException(status_code=404, detail=f"Service '{service_name}' not found")
    
    return ServiceResponse(
        success=True,
        message=f"Details for {service_name}",
        data=service,
        service=settings.service_name,
        version=settings.service_version
    )

@app.get("/call/{service_name}")
async def call_service(service_name: str, path: str = ""):
    """فراخوانی یک سرویس دیگر از طریق Consul"""
    if not settings.consul_enabled:
        raise HTTPException(status_code=503, detail="Consul is disabled")
    
    service = consul_client.get_service(service_name)
    if not service:
        raise HTTPException(status_code=404, detail=f"Service '{service_name}' not found")
    
    address = service.get("Address", service_name)
    port = service.get("Port", 80)
    url = f"http://{address}:{port}/{path}" if path else f"http://{address}:{port}"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=5.0)
            return ServiceResponse(
                success=response.status_code == 200,
                message=f"Called {service_name} successfully",
                data={
                    "url": url,
                    "status_code": response.status_code,
                    "response": response.json() if response.headers.get("content-type") == "application/json" else response.text
                },
                service=settings.service_name,
                version=settings.service_version
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calling {service_name}: {str(e)}")

# ==================== CRUD Cards ====================

cards_db: List[Card] = []
next_id = 1

@app.post("/cards")
async def create_card(card: Card):
    global next_id
    card.id = next_id
    card.created_at = datetime.utcnow()
    card.updated_at = datetime.utcnow()
    cards_db.append(card)
    next_id += 1
    return ServiceResponse(
        success=True,
        message="Card created",
        data=card.dict(),
        service=settings.service_name,
        version=settings.service_version
    )

@app.get("/cards")
async def get_cards():
    return ServiceResponse(
        success=True,
        message="All cards",
        data={"cards": [c.dict() for c in cards_db]},
        service=settings.service_name,
        version=settings.service_version
    )

@app.get("/cards/{card_id}")
async def get_card(card_id: int):
    for card in cards_db:
        if card.id == card_id:
            return ServiceResponse(
                success=True,
                message=f"Card {card_id}",
                data=card.dict(),
                service=settings.service_name,
                version=settings.service_version
            )
    raise HTTPException(status_code=404, detail="Card not found")