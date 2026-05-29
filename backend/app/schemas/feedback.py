"""Pydantic schemas for the feedback + memory endpoints."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GrammarMistakeItem(BaseModel):
    original: str
    corrected: str
    reason: str
    category: str | None = None
    severity: str | None = None


class VocabItem(BaseModel):
    word: str
    frequency: int | None = None


class FluencyMetrics(BaseModel):
    wpm: float | None = None
    avg_response_length_words: float | None = None
    filler_count: int | None = None


class BandEstimate(BaseModel):
    fluency: float | None = None
    grammar: float | None = None
    vocabulary: float | None = None
    overall: float | None = None


class AnalysisOut(BaseModel):
    session_id: UUID
    status: str  # "ready" | "pending"
    grammar_mistakes: list[GrammarMistakeItem] = []
    vocab_usage: list[VocabItem] = []
    fluency_metrics: FluencyMetrics = FluencyMetrics()
    band_estimate: BandEstimate = BandEstimate()
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ProfileOut(BaseModel):
    student_id: UUID
    status: str  # "ready" | "pending"
    overall_band: float | None = None
    fluency_band: float | None = None
    grammar_band: float | None = None
    vocabulary_band: float | None = None
    strengths: list[str] = []
    weaknesses: list[str] = []
    sessions_analyzed: int = 0
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class MemoryOut(BaseModel):
    id: UUID
    memory_type: str
    memory_value: str
    confidence_score: int
    updated_at: datetime

    model_config = {"from_attributes": True}
