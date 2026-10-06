"""Postgres persistence for enrollment-service.

System of record for persons/enrollments. Uses a lazy connection with an
in-memory fallback so the service still boots when the DB is unavailable.
"""

from __future__ import annotations

from datetime import datetime, timezone

from .config import settings
from .utils import get_logger

logger = get_logger(__name__)

SCHEMA = """
CREATE TABLE IF NOT EXISTS persons (
    id           TEXT PRIMARY KEY,
    full_name    TEXT NOT NULL,
    card_id      TEXT,
    image_key    TEXT,
    embedding_id TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


class PersonRepository:
    def __init__(self) -> None:
        self._conn = None
        self._memory: dict[str, dict] = {}

    def _connect(self):
        if self._conn is not None:
            return self._conn
        try:
            import psycopg

            self._conn = psycopg.connect(
                host=settings.db_host,
                port=settings.db_port,
                user=settings.db_user,
                password=settings.db_password,
                dbname=settings.db_name,
                autocommit=True,
            )
            with self._conn.cursor() as cur:
                cur.execute(SCHEMA)
            logger.info("Connected to Postgres %s/%s", settings.db_host, settings.db_name)
        except Exception as exc:  # pragma: no cover - infra dependent
            logger.warning("Postgres unavailable, using in-memory store: %s", exc)
            self._conn = None
        return self._conn

    def save(
        self,
        person_id: str,
        full_name: str,
        card_id: str,
        image_key: str,
        embedding_id: str,
    ) -> dict:
        created_at = datetime.now(timezone.utc)
        record = {
            "id": person_id,
            "full_name": full_name,
            "card_id": card_id,
            "image_key": image_key,
            "embedding_id": embedding_id,
            "created_at": created_at.isoformat(),
        }
        conn = self._connect()
        if conn is None:
            self._memory[person_id] = record
            return record
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO persons (id, full_name, card_id, image_key, embedding_id, created_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE
                  SET full_name = EXCLUDED.full_name,
                      card_id = EXCLUDED.card_id,
                      image_key = EXCLUDED.image_key,
                      embedding_id = EXCLUDED.embedding_id
                """,
                (person_id, full_name, card_id, image_key, embedding_id, created_at),
            )
        return record

    def get(self, person_id: str) -> dict | None:
        conn = self._connect()
        if conn is None:
            return self._memory.get(person_id)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, full_name, card_id, image_key, embedding_id, created_at "
                "FROM persons WHERE id = %s",
                (person_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            return {
                "id": row[0],
                "full_name": row[1],
                "card_id": row[2],
                "image_key": row[3],
                "embedding_id": row[4],
                "created_at": row[5].isoformat() if row[5] else None,
            }

    def list(self, limit: int = 100) -> list[dict]:
        conn = self._connect()
        if conn is None:
            return list(self._memory.values())[:limit]
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, full_name, card_id, image_key, embedding_id, created_at "
                "FROM persons ORDER BY created_at DESC LIMIT %s",
                (limit,),
            )
            return [
                {
                    "id": r[0],
                    "full_name": r[1],
                    "card_id": r[2],
                    "image_key": r[3],
                    "embedding_id": r[4],
                    "created_at": r[5].isoformat() if r[5] else None,
                }
                for r in cur.fetchall()
            ]

    def delete(self, person_id: str) -> None:
        conn = self._connect()
        if conn is None:
            self._memory.pop(person_id, None)
            return
        with conn.cursor() as cur:
            cur.execute("DELETE FROM persons WHERE id = %s", (person_id,))


person_repository = PersonRepository()
