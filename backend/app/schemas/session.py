"""Session-related Pydantic v2 schemas."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

MAX_TRANSCRIPT_SIZE = 1_048_576  # 1 MB — Red Team Fix #11


class SessionCreate(BaseModel):
    session_type: str  # class | playground | placement
    class_id: int | None = None
    topic_id: int | None = None

    @field_validator("session_type")
    @classmethod
    def validate_session_type(cls, v: str) -> str:
        allowed = {"class", "playground", "placement"}
        if v not in allowed:
            raise ValueError(f"session_type must be one of {allowed}")
        return v


class SessionPatch(BaseModel):
    ended_at: datetime | None = None
    transcript_json: Any | None = None  # size validated in route handler
    summary_json: Any | None = None
    xp_awarded: int | None = Field(default=None, ge=0)


class SkillScoreCreate(BaseModel):
    skill: str  # speaking | listening | grammar | pronunciation
    score: int = Field(ge=0, le=100)
    notes: str | None = None

    @field_validator("skill")
    @classmethod
    def validate_skill(cls, v: str) -> str:
        allowed = {"speaking", "listening", "grammar", "pronunciation"}
        if v not in allowed:
            raise ValueError(f"skill must be one of {allowed}")
        return v


class SessionResponse(BaseModel):
    id: int
    student_id: int
    class_id: int | None
    topic_id: int | None
    session_type: str
    started_at: datetime
    ended_at: datetime | None
    xp_awarded: int

    model_config = {"from_attributes": True}


class LevelUpRequest(BaseModel):
    """Internal endpoint body — identifies student by sub, not by auth token."""
    reason: str
    evidence: dict
    student_sub: str
