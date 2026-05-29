"""Schemas for mock test result endpoint."""
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class MockTestResultOut(BaseModel):
    session_id: UUID
    status: str  # "ready" | "pending"
    band_overall: float | None = None
    fluency_coherence: float | None = None
    lexical_resource: float | None = None
    grammatical_range_accuracy: float | None = None
    pronunciation: None = None  # always null — audio analysis deferred to future phase
    parts_completed: Any = None
    cue_card_topic: str | None = None
    premium: bool = True

    model_config = {"from_attributes": True}
