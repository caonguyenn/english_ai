"""Vocabulary tracking models — student vocab and word unlock lifecycle."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Float, ForeignKey, Integer, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKey


class StudentVocabulary(UUIDPrimaryKey, Base):
    """Tracks every word a student has used across sessions."""
    __tablename__ = "student_vocabulary"

    student_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    word: Mapped[str] = mapped_column(Text, nullable=False)
    usage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    mastery_score: Mapped[float] = mapped_column(Float, nullable=False, default=20.0)
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_used_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("student_id", "word", name="uq_student_vocabulary"),
    )


class WordUnlock(UUIDPrimaryKey, Base):
    """Tracks word-unlock lifecycle: introduced by AI → used by student → XP awarded."""
    __tablename__ = "word_unlocks"

    student_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    session_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    word: Mapped[str] = mapped_column(Text, nullable=False)
    introduced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    xp_awarded: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
