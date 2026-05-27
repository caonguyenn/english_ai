"""Student-related Pydantic v2 schemas."""
from datetime import datetime

from pydantic import BaseModel


class StudentUpdate(BaseModel):
    name: str | None = None


class StudentProgress(BaseModel):
    xp_total: int
    current_module_id: int | None
    current_module_title: str | None
    xp_in_module: int
    xp_threshold: int
    weak_areas: list[str]


class AuditLogEntry(BaseModel):
    id: int
    from_module_id: int
    to_module_id: int
    from_module_title: str | None
    to_module_title: str | None
    reason_text: str | None
    evidence_json: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class StudentHistory(BaseModel):
    id: int
    session_type: str
    started_at: datetime
    ended_at: datetime | None
    xp_awarded: int
    class_id: int | None
    topic_id: int | None

    model_config = {"from_attributes": True}
