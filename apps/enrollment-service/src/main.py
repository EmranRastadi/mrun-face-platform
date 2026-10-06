"""MRUN enrollment-service.

Owns the Person aggregate + face embeddings:
  - Postgres: person metadata (system of record)
  - MinIO:    enrollment images
  - Milvus:   face embedding vectors
  - Kafka:    emits enrollment.events
"""

from __future__ import annotations

import os
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, File, HTTPException, UploadFile

from .config import settings
from .database import person_repository
from .kafka_producer import event_publisher
from .models import HealthStatus, ServiceResponse
from .schemas import EnrollRequest, EnrollResponse, PersonResponse
from .storage_s3 import object_storage
from .utils import consul_client, get_logger
from .vector_milvus import vector_store

logger = get_logger(__name__)
START_TIME = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s", settings.service_name)
    if settings.consul_enabled:
        pod_name = os.getenv("HOSTNAME", "local")
        consul_client.register_service(
            name=settings.service_name,
            service_id=f"{settings.service_name}-{pod_name}",
            address=pod_name,
            port=settings.port,
        )
    yield
    event_publisher.close()
    logger.info("Stopping %s", settings.service_name)


app = FastAPI(
    title="MRUN Enrollment Service",
    version=settings.service_version,
    description="Person/face enrollment (MinIO + Milvus + Postgres + Kafka)",
    lifespan=lifespan,
)


@app.get("/")
async def root():
    return ServiceResponse(
        success=True,
        message=f"Welcome to {settings.service_name}",
        data={"service": settings.service_name, "docs": "/docs"},
        service=settings.service_name,
        version=settings.service_version,
    )


@app.get("/health")
async def health():
    return HealthStatus(
        service=settings.service_name,
        status="healthy",
        version=settings.service_version,
        uptime=time.time() - START_TIME,
        checks={"service": True},
    )


@app.post("/enroll", response_model=EnrollResponse)
async def enroll(payload: EnrollRequest):
    """Enroll a person with a precomputed embedding."""
    person_id = str(uuid.uuid4())
    embedding_id = str(uuid.uuid4())
    enrolled_at = datetime.now(timezone.utc)
    image_key = f"persons/{person_id}.jpg"

    try:
        vector_store.upsert(
            embedding_id,
            payload.embedding,
            {"person_id": person_id, "card_id": payload.card_id},
        )
    except Exception as exc:  # pragma: no cover - infra dependent
        logger.warning("Milvus upsert failed: %s", exc)

    record = person_repository.save(
        person_id=person_id,
        full_name=payload.full_name,
        card_id=payload.card_id,
        image_key=image_key,
        embedding_id=embedding_id,
    )

    event_publisher.publish(
        "enrollment.person.enrolled",
        person_id,
        {
            "personId": person_id,
            "cardId": payload.card_id,
            "fullName": payload.full_name,
            "imageKey": image_key,
            "embeddingId": embedding_id,
            "enrolledAt": enrolled_at.isoformat(),
        },
    )

    return EnrollResponse(
        person_id=person_id,
        card_id=payload.card_id,
        image_key=image_key,
        embedding_id=embedding_id,
        enrolled_at=enrolled_at.isoformat(),
    )


@app.post("/enroll/{person_id}/image")
async def upload_image(person_id: str, file: UploadFile = File(...)):
    """Upload/replace the enrollment image for a person (stored in MinIO)."""
    person = person_repository.get(person_id)
    if person is None:
        raise HTTPException(status_code=404, detail="Person not found")
    data = await file.read()
    key = f"persons/{person_id}.jpg"
    try:
        object_storage.put_image(key, data, file.content_type or "image/jpeg")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Storage error: {exc}") from exc
    return ServiceResponse(
        success=True,
        message="Image uploaded",
        data={"person_id": person_id, "image_key": key},
        service=settings.service_name,
        version=settings.service_version,
    )


@app.get("/persons", response_model=list[PersonResponse])
async def list_persons(limit: int = 100):
    return person_repository.list(limit=limit)


@app.get("/persons/{person_id}", response_model=PersonResponse)
async def get_person(person_id: str):
    person = person_repository.get(person_id)
    if person is None:
        raise HTTPException(status_code=404, detail="Person not found")
    return person


@app.delete("/persons/{person_id}")
async def delete_person(person_id: str):
    person = person_repository.get(person_id)
    if person is None:
        raise HTTPException(status_code=404, detail="Person not found")
    if person.get("embedding_id"):
        try:
            vector_store.delete(person["embedding_id"])
        except Exception as exc:  # pragma: no cover
            logger.warning("Milvus delete failed: %s", exc)
    person_repository.delete(person_id)
    return ServiceResponse(
        success=True,
        message="Person deleted",
        data={"person_id": person_id},
        service=settings.service_name,
        version=settings.service_version,
    )
