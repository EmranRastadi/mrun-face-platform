"""In-memory camera registry (Phase 1). DB-backed in a later phase."""

from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional


@dataclass
class CameraRecord:
    id: str
    name: str
    rtsp_url: str
    organization_id: str
    sample_fps: float
    enabled: bool = True
    status: str = "idle"  # idle | running | error
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_frame_at: Optional[str] = None
    last_error: Optional[str] = None
    frame_count: int = 0


class CameraRegistry:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._cameras: Dict[str, CameraRecord] = {}

    def add(self, name: str, rtsp_url: str, organization_id: str = "", sample_fps: float = 1.0) -> CameraRecord:
        cam = CameraRecord(
            id=str(uuid.uuid4()),
            name=name,
            rtsp_url=rtsp_url,
            organization_id=organization_id,
            sample_fps=sample_fps,
        )
        with self._lock:
            self._cameras[cam.id] = cam
        return cam

    def get(self, camera_id: str) -> Optional[CameraRecord]:
        with self._lock:
            return self._cameras.get(camera_id)

    def list(self) -> List[CameraRecord]:
        with self._lock:
            return list(self._cameras.values())

    def remove(self, camera_id: str) -> bool:
        with self._lock:
            return self._cameras.pop(camera_id, None) is not None

    def update_status(self, camera_id: str, status: str, error: Optional[str] = None) -> None:
        with self._lock:
            cam = self._cameras.get(camera_id)
            if cam:
                cam.status = status
                cam.last_error = error

    def touch_frame(self, camera_id: str) -> None:
        with self._lock:
            cam = self._cameras.get(camera_id)
            if cam:
                cam.last_frame_at = datetime.now(timezone.utc).isoformat()
                cam.frame_count += 1


registry = CameraRegistry()
