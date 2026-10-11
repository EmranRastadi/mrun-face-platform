"""MRUN worker-service — recognition worker entrypoint.

Best-practice scaffold: real FastAPI app (so container boots),
/health + /ready endpoints, Kafka consumer hook ready to wire
to topics defined in packages/events.
"""

import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI

START_TIME = time.time()
KAFKA_ENABLED = os.getenv("KAFKA_ENABLED", "false").lower() == "true"
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "kafka:9092")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # TODO: start Kafka consumer loop here when KAFKA_ENABLED.
    # Topics (see packages/events): recognition.events, vision.events
    yield


app = FastAPI(
    title="MRUN Worker Service",
    version="0.1.0",
    description="Recognition worker (Kafka consumer scaffold)",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "worker-service"}


@app.get("/ready")
async def ready():
    return {
        "ready": True,
        "uptime": time.time() - START_TIME,
        "checks": {"kafka": True if not KAFKA_ENABLED else False},
        "kafka_brokers": KAFKA_BROKERS,
    }
