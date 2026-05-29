"""Schemas for lesson stage endpoints."""
from pydantic import BaseModel, Field


class VocabStageWord(BaseModel):
    word: str
    meaning: str


class GrammarFocus(BaseModel):
    category: str
    note: str | None = None


class LessonStagesOut(BaseModel):
    vocab: list[VocabStageWord] = []
    grammar_focus: GrammarFocus | None = None


class StagePatchIn(BaseModel):
    stage: int = Field(ge=1, le=4)
