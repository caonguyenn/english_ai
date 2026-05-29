"""Gamification models — streaks, achievements, student_achievements."""
from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Date, DateTime, ForeignKey, Integer, JSON, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKey


class Streak(Base):
    """One row per student — tracks current and longest streak."""
    __tablename__ = "streaks"

    student_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("students.id", ondelete="CASCADE"),
        primary_key=True, nullable=False,
    )
    current_len: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    longest_len: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_active_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class Achievement(UUIDPrimaryKey, Base):
    """Achievement definitions — seeded data, criteria as JSONB."""
    __tablename__ = "achievements"

    slug: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    criteria_json: Mapped[Any] = mapped_column(JSON, nullable=False)  # {"type":..., "threshold":...}


class StudentAchievement(Base):
    """Many-to-many: which students have earned which achievements."""
    __tablename__ = "student_achievements"

    student_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("students.id", ondelete="CASCADE"),
        primary_key=True, nullable=False,
    )
    achievement_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("achievements.id", ondelete="CASCADE"),
        primary_key=True, nullable=False,
    )
    earned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
