"""Learning intelligence models — analysis results, student profiles, study plans."""
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, JSON, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKey


class AnalysisResult(UUIDPrimaryKey, Base):
    """Per-session Nova Lite analysis output."""
    __tablename__ = "analysis_results"

    session_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    student_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    grammar_mistakes: Mapped[Any] = mapped_column(JSON, nullable=True)
    vocab_usage: Mapped[Any] = mapped_column(JSON, nullable=True)
    fluency_metrics: Mapped[Any] = mapped_column(JSON, nullable=True)
    band_estimate: Mapped[Any] = mapped_column(JSON, nullable=True)
    raw_nova_output: Mapped[Any] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class StudentLearningProfile(UUIDPrimaryKey, Base):
    """Rolling learning profile — accumulated across all sessions."""
    __tablename__ = "student_learning_profiles"

    student_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    # Rolling band estimates (null until enough sessions)
    fluency_band: Mapped[float | None] = mapped_column(nullable=True)
    grammar_band: Mapped[float | None] = mapped_column(nullable=True)
    vocabulary_band: Mapped[float | None] = mapped_column(nullable=True)
    overall_band: Mapped[float | None] = mapped_column(nullable=True)
    # Accumulated insight lists
    strengths: Mapped[Any] = mapped_column(JSON, nullable=True)    # list[str]
    weaknesses: Mapped[Any] = mapped_column(JSON, nullable=True)   # list[str]
    # Grammar mistake frequencies: {"tense": 12, "article": 5, ...}
    mistake_frequencies: Mapped[Any] = mapped_column(JSON, nullable=True)
    # Vocab mastery deltas: {"word": cumulative_delta, ...}
    vocab_mastery: Mapped[Any] = mapped_column(JSON, nullable=True)
    # How many sessions contributed to this profile
    sessions_analyzed: Mapped[int] = mapped_column(nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
        onupdate=func.now(), nullable=False
    )


class StudyPlan(UUIDPrimaryKey, Base):
    """Generated study plan — one active plan per student."""
    __tablename__ = "study_plans"

    student_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    # Source analysis that triggered this plan
    source_analysis_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("analysis_results.id", ondelete="SET NULL"), nullable=True
    )
    generated_plan: Mapped[Any] = mapped_column(JSON, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
        onupdate=func.now(), nullable=False
    )
