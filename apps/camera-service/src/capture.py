"""Frame capture loop using ffmpeg + optional Kafka/MinIO."""

from __future__ import annotations

import json
import logging
import os
import subprocess
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .config import settings
from .camera_registry import registry

logger = logging.getLogger(__name__)


def _ensure_dir(path: str) -> None:
    Path(path).mkdir(parents=True, exist_ok=True)


def _kafka_producer():
    if not settings.kafka_enabled:
        return None
    try:
        from kafka import KafkaProducer

        return KafkaProducer(
            bootstrap_servers=settings.kafka_brokers.split(","),
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        )
    except Exception as exc:  # pragma: no cover
        logger.warning("Kafka unavailable: %s", exc)
        return None


def _minio_client():
    if not settings.minio_enabled:
        return None
    try:
        from minio import Minio

        return Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
    except Exception as exc:  # pragma: no cover
        logger.warning("MinIO unavailable: %s", exc)
        return None


class CaptureWorker:
    def __init__(self, camera_id: str) -> None:
        self.camera_id = camera_id
        self._thread: Optional[threading.Thread] = None
        self._stop = threading.Event()

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, daemon=True, name=f"capture-{self.camera_id}")
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=10)

    def _run(self) -> None:
        cam = registry.get(self.camera_id)
        if not cam:
            logger.error("Camera %s not found", self.camera_id)
            return
        registry.update_status(self.camera_id, "running")
        producer = _kafka_producer()
        minio = _minio_client()
        if minio is not None:
            try:
                if not minio.bucket_exists(settings.minio_bucket):
                    minio.make_bucket(settings.minio_bucket)
            except Exception as exc:
                logger.warning("MinIO bucket check failed: %s", exc)
                minio = None

        interval = 1.0 / max(cam.sample_fps, 0.1)
        _ensure_dir(settings.frame_dir)

        while not self._stop.is_set():
            started = time.time()
            try:
                frame_id = str(uuid.uuid4())
                ts = datetime.now(timezone.utc).isoformat()
                out_path = os.path.join(settings.frame_dir, f"{cam.id}_{frame_id}.jpg")

                # Use ffmpeg to grab a single frame.
                cmd = [
                    "ffmpeg", "-y", "-rtsp_transport", "tcp",
                    "-i", cam.rtsp_url,
                    "-frames:v", "1", "-q:v", "2",
                    "-update", "1", out_path,
                ]
                subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15, check=True)

                if not os.path.exists(out_path):
                    raise RuntimeError("ffmpeg produced no frame")

                storage_key = f"{cam.id}/{frame_id}.jpg"
                if minio is not None:
                    try:
                        minio.fput_object(settings.minio_bucket, storage_key, out_path)
                    except Exception as exc:
                        logger.warning("MinIO upload failed: %s", exc)

                # Probe dimensions via a cheap ffmpeg/ffprobe? Use a fixed approach: read header with PIL if available.
                width, height = _probe_dimensions(out_path)

                event = {
                    "eventId": frame_id,
                    "eventName": "vision.frame.captured",
                    "occurredOn": ts,
                    "aggregateId": cam.id,
                    "version": 1,
                    "payload": {
                        "cameraId": cam.id,
                        "frameId": frame_id,
                        "frameKey": storage_key,
                        "capturedAt": ts,
                        "width": width,
                        "height": height,
                        "storageKey": storage_key,
                        "thumbnailKey": None,
                        "organizationId": cam.organization_id or None,
                        "imageUrl": out_path,
                    },
                }

                if producer is not None:
                    try:
                        producer.send(settings.kafka_topic, key=cam.id, value=event)
                        producer.flush(timeout=5)
                    except Exception as exc:
                        logger.warning("Kafka publish failed: %s", exc)
                else:
                    logger.info("frame captured (kafka disabled): %s", out_path)

                registry.touch_frame(cam.id)
            except Exception as exc:
                logger.warning("capture failed for %s: %s", cam.id, exc)
                registry.update_status(cam.id, "error", str(exc))

            elapsed = time.time() - started
            sleep_for = max(0.0, interval - elapsed)
            if self._stop.wait(sleep_for):
                break

        registry.update_status(self.camera_id, "idle")
        if producer is not None:
            producer.close()
        logger.info("capture stopped for %s", self.camera_id)


def _probe_dimensions(path: str):
    try:
        from PIL import Image

        with Image.open(path) as im:
            return im.size
    except Exception:
        # Fallback: parse via ffprobe would be heavy; return defaults.
        return 1280, 800


_workers: dict[str, CaptureWorker] = {}
_workers_lock = threading.Lock()


def start_capture(camera_id: str) -> CaptureWorker:
    with _workers_lock:
        w = _workers.get(camera_id)
        if w is None:
            w = CaptureWorker(camera_id)
            _workers[camera_id] = w
        w.start()
        return w


def stop_capture(camera_id: str) -> None:
    with _workers_lock:
        w = _workers.pop(camera_id, None)
    if w:
        w.stop()


def is_running(camera_id: str) -> bool:
    with _workers_lock:
        w = _workers.get(camera_id)
        return bool(w and w._thread and w._thread.is_alive())
