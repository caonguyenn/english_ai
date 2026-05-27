from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class LevelAuditLog(Base):
    __tablename__ = "level_audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_module_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("modules.id", ondelete="RESTRICT"), nullable=False
    )
    to_module_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("modules.id", ondelete="RESTRICT"), nullable=False
    )
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True
    )
    reason_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_json: Mapped[Any] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
