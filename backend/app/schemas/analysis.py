"""Pydantic v2 schema for Nova Lite analysis output validation."""
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class GrammarMistake(BaseModel):
    category: str
    original: str
    corrected: str
    severity: Literal["minor", "moderate", "major"]
    explanation: str = ""


class VocabEntry(BaseModel):
    word: str
    cefr_level: Literal["A1", "A2", "B1", "B2", "C1", "C2"]
    used_correctly: bool
    mastery_signal: Literal["emerging", "developing", "secure"]


class FluencyMetrics(BaseModel):
    coherence_score: float = Field(ge=0, le=100)
    discourse_markers: list[str] = Field(default_factory=list)
    self_corrections: int = Field(ge=0, default=0)
    avg_response_length_words: float = Field(ge=0, default=0.0)


class BandEstimate(BaseModel):
    overall: float = Field(ge=1, le=9)
    fluency: float = Field(ge=1, le=9)
    grammar: float = Field(ge=1, le=9)
    vocabulary: float = Field(ge=1, le=9)
    pronunciation: None = None  # Always null — cannot score from text
    estimate_note: str = "text-derived; pronunciation excluded"

    @model_validator(mode="after")
    def bands_in_half_increments(self) -> "BandEstimate":
        for field in ("overall", "fluency", "grammar", "vocabulary"):
            val = getattr(self, field)
            # Round to nearest 0.5
            object.__setattr__(self, field, round(val * 2) / 2)
        return self


class AnalysisOutput(BaseModel):
    """Full structured output from Nova Lite. Used for validation + DB storage."""
    grammar_mistakes: list[GrammarMistake] = Field(default_factory=list)
    vocab_usage: list[VocabEntry] = Field(default_factory=list)
    fluency_metrics: FluencyMetrics
    band_estimate: BandEstimate
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)


class AnalysisResultResponse(BaseModel):
    """REST response schema for GET /sessions/{id}/analysis."""
    id: UUID
    session_id: UUID
    student_id: UUID
    grammar_mistakes: list[dict]
    vocab_usage: list[dict]
    fluency_metrics: dict
    band_estimate: dict

    model_config = {"from_attributes": True}
