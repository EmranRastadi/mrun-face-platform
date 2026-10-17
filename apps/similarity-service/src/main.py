"""MRUN similarity-service scaffold. See packages/proto/similarity.proto for contract."""

from fastapi import FastAPI

app = FastAPI(title='similarity-service', version='0.1.0')


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}
