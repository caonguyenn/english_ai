"""Pydantic schemas for grammar endpoints."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GrammarWeaknessOut(BaseModel):
    id: UUID
    student_id: UUID
    category: str
    frequency: int
    severity: float
    times_seen: int
    updated_at: datetime

    model_config = {"from_attributes": True}


class GrammarExerciseOut(BaseModel):
    """Client-facing exercise — answer key stripped."""
    id: UUID
    student_id: UUID
    category: str
    prompt: str
    options: dict[str, str]
    answered_correctly: bool | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class GrammarAnswerIn(BaseModel):
    selected: str  # "A" | "B" | "C" | "D"


class GrammarAnswerResult(BaseModel):
    correct: bool
    correct_option: str
    explanation: str
    xp_awarded: int
