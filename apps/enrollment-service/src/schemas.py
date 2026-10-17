"""Request/response schemas for enrollment endpoints."""

from pydantic import BaseModel, Field


class EnrollRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=200)
    card_id: str = Field(..., min_length=1)
    # Embedding vector (already computed by the vision pipeline).
    embedding: list[float] = Field(..., min_length=1)


class EnrollResponse(BaseModel):
    person_id: str
    card_id: str
    image_key: str
    embedding_id: str
    enrolled_at: str


class PersonResponse(BaseModel):
    id: str
    full_name: str
    card_id: str | None = None
    image_key: str | None = None
    created_at: str | None = None
