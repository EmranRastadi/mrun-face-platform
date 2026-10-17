"""Kafka producer for enrollment events (lazy, optional)."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from .config import settings
from .utils import get_logger

logger = get_logger(__name__)

ENROLLMENT_TOPIC = "enrollment.events"


class EventPublisher:
    def __init__(self) -> None:
        self._producer = None

    @property
    def producer(self):
        if self._producer is None:
            from kafka import KafkaProducer

            self._producer = KafkaProducer(
                bootstrap_servers=settings.kafka_brokers.split(","),
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                key_serializer=lambda k: k.encode("utf-8") if k else None,
            )
        return self._producer

    def publish(self, event_name: str, aggregate_id: str, payload: dict) -> None:
        if not settings.kafka_enabled:
            logger.info("Kafka disabled; skipping event %s", event_name)
            return
        event = {
            "eventId": f"{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            "eventName": event_name,
            "occurredOn": datetime.now(timezone.utc).isoformat(),
            "aggregateId": aggregate_id,
            "version": 1,
            "payload": payload,
        }
        self.producer.send(
            ENROLLMENT_TOPIC, key=aggregate_id, value=event
        )
        self.producer.flush()

    def close(self) -> None:
        if self._producer is not None:
            self._producer.close()


event_publisher = EventPublisher()
