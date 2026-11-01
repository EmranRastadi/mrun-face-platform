"""MRUN camera-service scaffold. See packages/proto/camera.proto for contract."""

from fastapi import FastAPI

from .observability import setup_observability

app = FastAPI(title='camera-service', version='0.1.0')

setup_observability(app, 'camera-service')


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}
