"""Student memory model — facts extracted from session transcripts."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKey


class StudentMemory(UUIDPrimaryKey, Base):
    """Long-term facts about a student, extracted from session transcripts."""
    __tablename__ = "student_memories"

    student_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    memory_type: Mapped[str] = mapped_column(Text, nullable=False)
    memory_value: Mapped[str] = mapped_column(Text, nullable=False)
    confidence_score: Mapped[int] = mapped_column(Integer, nullable=False)
    source_session_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("student_id", "memory_type", "memory_value", name="uq_student_memory"),
    )
