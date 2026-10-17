"""MinIO / S3 object storage client (lazy, degrades gracefully)."""

from __future__ import annotations

import io

import boto3
from botocore.client import Config

from .config import settings
from .utils import get_logger

logger = get_logger(__name__)


class ObjectStorage:
    def __init__(self) -> None:
        self._client = None

    @property
    def client(self):
        if self._client is None:
            self._client = boto3.client(
                "s3",
                endpoint_url=f"http{'s' if settings.minio_secure else ''}://{settings.minio_endpoint}",
                aws_access_key_id=settings.minio_access_key,
                aws_secret_access_key=settings.minio_secret_key,
                config=Config(signature_version="s3v4"),
                region_name="us-east-1",
            )
        return self._client

    def ensure_bucket(self) -> None:
        try:
            self.client.head_bucket(Bucket=settings.minio_bucket)
        except Exception:
            self.client.create_bucket(Bucket=settings.minio_bucket)
            logger.info("Created bucket %s", settings.minio_bucket)

    def put_image(self, key: str, data: bytes, content_type: str = "image/jpeg") -> str:
        self.ensure_bucket()
        self.client.put_object(
            Bucket=settings.minio_bucket,
            Key=key,
            Body=io.BytesIO(data),
            ContentType=content_type,
        )
        return key

    def presigned_url(self, key: str, expires_in: int = 3600) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.minio_bucket, "Key": key},
            ExpiresIn=expires_in,
        )


object_storage = ObjectStorage()
