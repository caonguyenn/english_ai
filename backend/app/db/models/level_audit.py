from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, JSON, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKey


class LevelAuditLog(UUIDPrimaryKey, Base):
    __tablename__ = "level_audit_log"

    student_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_module_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("modules.id", ondelete="RESTRICT"), nullable=True
    )
    to_module_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("modules.id", ondelete="RESTRICT"), nullable=False
    )
    session_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True
    )
    reason_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_json: Mapped[Any] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
