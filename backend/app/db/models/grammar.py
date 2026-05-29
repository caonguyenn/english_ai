"""Grammar weakness and exercise models."""
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKey


class StudentGrammarWeakness(UUIDPrimaryKey, Base):
    """Accumulated grammar weakness per student per category."""
    __tablename__ = "student_grammar_weaknesses"

    student_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    category: Mapped[str] = mapped_column(Text, nullable=False)  # e.g. "past_tense"
    frequency: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    severity: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    times_seen: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("student_id", "category", name="uq_student_grammar_category"),
    )


class GrammarExercise(UUIDPrimaryKey, Base):
    """Generated MCQ exercise for a student."""
    __tablename__ = "grammar_exercises"

    student_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    category: Mapped[str] = mapped_column(Text, nullable=False)
    question_json: Mapped[Any] = mapped_column(JSON, nullable=False)
    # answered_correctly is None while pending, True/False after answer
    answered_correctly: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
