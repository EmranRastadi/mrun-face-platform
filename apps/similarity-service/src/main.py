"""MRUN similarity-service scaffold. See packages/proto/similarity.proto for contract."""

from fastapi import FastAPI

from .observability import setup_observability

app = FastAPI(title='similarity-service', version='0.1.0')

setup_observability(app, 'similarity-service')


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}
