import enum
from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPrimaryKey


class SkillType(str, enum.Enum):
    speaking = "speaking"
    listening = "listening"
    grammar = "grammar"
    pronunciation = "pronunciation"
    vocabulary = "vocabulary"


class Module(UUIDPrimaryKey, Base):
    __tablename__ = "modules"

    band_min: Mapped[float] = mapped_column(Float, nullable=False)
    band_max: Mapped[float] = mapped_column(Float, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    xp_threshold: Mapped[int] = mapped_column(nullable=False)
    order_index: Mapped[int] = mapped_column(nullable=False)

    classes: Mapped[list["Class"]] = relationship(
        "Class", back_populates="module", lazy="raise"
    )


class Class(UUIDPrimaryKey, Base):
    __tablename__ = "classes"

    module_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("modules.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    skill_type: Mapped[SkillType] = mapped_column(
        Enum(SkillType, name="skill_type_enum"), nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    system_prompt_addendum: Mapped[str | None] = mapped_column(Text, nullable=True)
    xp_reward: Mapped[int] = mapped_column(nullable=False, default=0)
    order_index: Mapped[int] = mapped_column(nullable=False)

    module: Mapped[Module] = relationship("Module", back_populates="classes", lazy="raise")


class Enrollment(Base):
    __tablename__ = "enrollments"

    student_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("students.id", ondelete="CASCADE"), primary_key=True
    )
    module_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("modules.id", ondelete="CASCADE"), primary_key=True
    )
    xp_earned: Mapped[int] = mapped_column(nullable=False, default=0)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
