"""Admin-specific Pydantic v2 schemas."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AdminStudentEdit(BaseModel):
    name: str | None = None
    xp_total: int | None = Field(default=None, ge=0)
    current_module_id: int | None = None
    placement_band: float | None = None


class AdminStudentResponse(BaseModel):
    id: int
    cognito_sub: str
    name: str | None
    email: str
    current_module_id: int | None
    placement_band: float | None
    xp_total: int
    placement_completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminSessionResponse(BaseModel):
    id: int
    student_id: int
    class_id: int | None
    topic_id: int | None
    session_type: str
    started_at: datetime
    ended_at: datetime | None
    xp_awarded: int
    transcript_json: Any | None
    summary_json: Any | None

    model_config = {"from_attributes": True}
