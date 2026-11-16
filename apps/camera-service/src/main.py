"""MRUN camera-service: ingest (frame capture) + WebRTC signaling."""

from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .config import settings
from .camera_registry import registry, CameraRecord
from .capture import start_capture, stop_capture, is_running
from .observability import setup_observability
from .webrtc.router import STATIC_DIR
from .webrtc.router import router as webrtc_router

logger_name = "camera-service"
START_TIME = time.time()


class RegisterCamera(BaseModel):
    name: str
    rtsp_url: str
    organization_id: str = ""
    sample_fps: float = 1.0


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-register a default camera from env.
    if settings.camera_rtsp_url:
        cam = registry.add(settings.camera_name, settings.camera_rtsp_url, settings.camera_organization_id, settings.sample_fps)
        app.state.default_camera_id = cam.id
    yield
    # Stop all captures on shutdown.
    for c in registry.list():
        try:
            stop_capture(c.id)
        except Exception:
            pass


app = FastAPI(title="camera-service", version="0.2.0", lifespan=lifespan)

ALLOWED_HTTP_METHODS = "GET, POST, PUT, PATCH, DELETE"


@app.middleware("http")
async def reject_unsupported_http_methods(request: Request, call_next):
    if request.method in {"HEAD", "OPTIONS"}:
        headers = {"Allow": ALLOWED_HTTP_METHODS, "Cache-Control": "no-store"}
        if request.method == "HEAD":
            return Response(status_code=405, headers=headers)
        return Response(content='{"detail":"Method Not Allowed"}', status_code=405, media_type="application/json", headers=headers)
    return await call_next(request)


setup_observability(app, "camera-service")

app.include_router(webrtc_router)
app.mount("/webrtc/static", StaticFiles(directory=STATIC_DIR), name="webrtc-static")


@app.get("/health")
def health():
    return {"status": "ok", "service": "camera-service", "uptime": time.time() - START_TIME}


@app.get("/ready")
def ready():
    cams = registry.list()
    return {
        "ready": True,
        "uptime": time.time() - START_TIME,
        "cameras": len(cams),
        "running": sum(1 for c in cams if is_running(c.id)),
    }


@app.get("/cameras")
def list_cameras():
    return [
        {
            "id": c.id,
            "name": c.name,
            "organization_id": c.organization_id,
            "sample_fps": c.sample_fps,
            "enabled": c.enabled,
            "status": c.status,
            "last_frame_at": c.last_frame_at,
            "frame_count": c.frame_count,
            "last_error": c.last_error,
        }
        for c in registry.list()
    ]


@app.post("/cameras", status_code=201)
def register_camera(payload: RegisterCamera):
    cam = registry.add(payload.name, payload.rtsp_url, payload.organization_id, payload.sample_fps)
    return {"id": cam.id, "name": cam.name, "status": cam.status}


@app.get("/cameras/{camera_id}")
def get_camera(camera_id: str):
    cam = registry.get(camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    return {
        "id": cam.id,
        "name": cam.name,
        "rtsp_url": cam.rtsp_url,
        "organization_id": cam.organization_id,
        "sample_fps": cam.sample_fps,
        "enabled": cam.enabled,
        "status": cam.status,
        "last_frame_at": cam.last_frame_at,
        "frame_count": cam.frame_count,
        "last_error": cam.last_error,
    }


@app.delete("/cameras/{camera_id}")
def delete_camera(camera_id: str):
    stop_capture(camera_id)
    if not registry.remove(camera_id):
        raise HTTPException(status_code=404, detail="Camera not found")
    return {"ok": True}


@app.post("/cameras/{camera_id}/start")
def start_camera(camera_id: str):
    cam = registry.get(camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    start_capture(camera_id)
    return {"id": camera_id, "running": True}


@app.post("/cameras/{camera_id}/stop")
def stop_camera(camera_id: str):
    stop_capture(camera_id)
    return {"id": camera_id, "running": False}


@app.post("/cameras/{camera_id}/snapshot")
def snapshot(camera_id: str):
    cam = registry.get(camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    import subprocess, uuid, os
    frame_id = str(uuid.uuid4())
    out_path = os.path.join(settings.frame_dir, f"{cam.id}_{frame_id}.jpg")
    os.makedirs(settings.frame_dir, exist_ok=True)
    cmd = ["ffmpeg", "-y", "-rtsp_transport", "tcp", "-i", cam.rtsp_url, "-frames:v", "1", "-q:v", "2", "-update", "1", out_path]
    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15, check=True)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"snapshot failed: {exc}")
    if not os.path.exists(out_path):
        raise HTTPException(status_code=500, detail="no frame produced")
    registry.touch_frame(cam.id)
    return {"camera_id": camera_id, "frame_id": frame_id, "path": out_path, "size_bytes": os.path.getsize(out_path)}
