from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.module import Module


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cognito_sub: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    current_module_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("modules.id", ondelete="SET NULL"), nullable=True
    )
    placement_band: Mapped[float | None] = mapped_column(Float, nullable=True)
    xp_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    placement_completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    current_module: Mapped["Module | None"] = relationship(
        "Module", foreign_keys=[current_module_id], lazy="raise"
    )
