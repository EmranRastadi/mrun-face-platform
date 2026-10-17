"""Milvus vector store client (lazy connection).

This is the SOLE writer of the face_embeddings collection.
"""

from __future__ import annotations

from .config import settings
from .utils import get_logger

logger = get_logger(__name__)


class VectorStore:
    def __init__(self) -> None:
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from pymilvus import MilvusClient

            self._client = MilvusClient(
                uri=f"http://{settings.milvus_host}:{settings.milvus_port}"
            )
        return self._client

    def ensure_collection(self) -> None:
        try:
            if not self.client.has_collection(settings.milvus_collection):
                self.client.create_collection(
                    collection_name=settings.milvus_collection,
                    dimension=settings.milvus_dimension,
                    metric_type="COSINE",
                )
                logger.info("Created Milvus collection %s", settings.milvus_collection)
        except Exception as exc:  # pragma: no cover - infra dependent
            logger.warning("Milvus ensure_collection failed: %s", exc)

    def upsert(self, embedding_id: str, vector: list[float], metadata: dict) -> None:
        self.ensure_collection()
        self.client.upsert(
            collection_name=settings.milvus_collection,
            data=[
                {
                    "id": embedding_id,
                    "vector": vector,
                    **{k: v for k, v in metadata.items() if k != "id"},
                }
            ],
        )

    def delete(self, embedding_id: str) -> None:
        self.client.delete(
            collection_name=settings.milvus_collection, ids=[embedding_id]
        )


vector_store = VectorStore()
