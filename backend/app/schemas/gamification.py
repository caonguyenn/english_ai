"""Pydantic schemas for gamification endpoints."""
from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class StreakOut(BaseModel):
    student_id: UUID
    current_len: int
    longest_len: int
    last_active_date: date | None = None

    model_config = {"from_attributes": True}


class AchievementOut(BaseModel):
    id: UUID
    slug: str
    title: str
    description: str | None = None
    criteria_json: Any = None
    earned: bool = False
    earned_at: datetime | None = None

    model_config = {"from_attributes": True}
