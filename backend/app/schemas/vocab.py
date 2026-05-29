"""Pydantic schemas for vocabulary endpoints."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class VocabularyOut(BaseModel):
    id: UUID
    student_id: UUID
    word: str
    usage_count: int
    mastery_score: float
    first_seen_at: datetime
    last_used_at: datetime

    model_config = {"from_attributes": True}


class WordUnlockOut(BaseModel):
    id: UUID
    student_id: UUID
    session_id: UUID
    word: str
    introduced_at: datetime
    used_at: datetime | None = None
    xp_awarded: int

    model_config = {"from_attributes": True}
