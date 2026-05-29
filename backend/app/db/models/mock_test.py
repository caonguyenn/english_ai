"""Mock test metadata model — stores exam-specific info separate from skill scores."""
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, JSON, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKey


class MockTestResult(UUIDPrimaryKey, Base):
    """Stores IELTS mock test exam metadata (parts completed, cue card topic).

    Skill scores are stored in the standard skill_scores table.
    Band estimates come from the Phase 1 analysis engine (analysis_results).
    """
    __tablename__ = "mock_test_results"

    session_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    parts_completed: Mapped[Any] = mapped_column(JSON, nullable=True)
    cue_card_topic: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
