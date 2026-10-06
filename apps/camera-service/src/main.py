"""MRUN camera-service scaffold. See packages/proto/camera.proto for contract."""

from fastapi import FastAPI

app = FastAPI(title='camera-service', version='0.1.0')


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}
