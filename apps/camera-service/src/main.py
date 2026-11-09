"""MRUN camera-service scaffold. See packages/proto/camera.proto for contract."""

from fastapi import FastAPI, Request, Response
from fastapi.staticfiles import StaticFiles

from .observability import setup_observability
from .webrtc.router import STATIC_DIR
from .webrtc.router import router as webrtc_router

app = FastAPI(title='camera-service', version='0.1.0')

ALLOWED_HTTP_METHODS = 'GET, POST, PUT, PATCH, DELETE'


@app.middleware('http')
async def reject_unsupported_http_methods(request: Request, call_next):
    """Reject HEAD and OPTIONS before routing or instrumentation can answer them."""
    if request.method in {'HEAD', 'OPTIONS'}:
        headers = {
            'Allow': ALLOWED_HTTP_METHODS,
            'Cache-Control': 'no-store',
        }
        if request.method == 'HEAD':
            return Response(status_code=405, headers=headers)
        return Response(
            content='{"detail":"Method Not Allowed"}',
            status_code=405,
            media_type='application/json',
            headers=headers,
        )
    return await call_next(request)


setup_observability(app, 'camera-service')

app.include_router(webrtc_router)
app.mount('/webrtc/static', StaticFiles(directory=STATIC_DIR), name='webrtc-static')


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}
