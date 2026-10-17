# enrollment-service

Owns the **Person** aggregate and face embeddings.

- **Postgres** (`enrollment` db): `persons` table — system of record.
- **MinIO** (`enroll` bucket): enrollment images.
- **Milvus** (`face_embeddings`): face vectors — sole writer.
- **Kafka** (`enrollment.events`): emits `enrollment.person.enrolled`.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/enroll` | Enroll person with embedding vector |
| POST | `/enroll/{person_id}/image` | Upload person image to MinIO |
| GET | `/persons` | List persons |
| GET | `/persons/{person_id}` | Get person |
| DELETE | `/persons/{person_id}` | Delete person + vector |

## Run

```bash
cp .env.example .env
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8001
```
