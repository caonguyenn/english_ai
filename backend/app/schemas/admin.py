"""Admin-specific Pydantic v2 schemas."""
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class AdminStudentEdit(BaseModel):
    name: str | None = None
    xp_total: int | None = Field(default=None, ge=0)
    current_module_id: UUID | None = None
    placement_band: float | None = None


class AdminStudentResponse(BaseModel):
    id: UUID
    cognito_sub: str
    name: str | None
    email: str
    current_module_id: UUID | None
    placement_band: float | None
    xp_total: int
    placement_completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminSessionResponse(BaseModel):
    id: UUID
    student_id: UUID
    class_id: UUID | None
    topic_id: UUID | None
    session_type: str
    started_at: datetime
    ended_at: datetime | None
    xp_awarded: int
    transcript_json: Any | None
    summary_json: Any | None

    model_config = {"from_attributes": True}
