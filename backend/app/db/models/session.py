import enum
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.module import SkillType


class SessionType(str, enum.Enum):
    # "class" is a Python keyword; stored as the string "class" in the DB
    class_ = "class"
    playground = "playground"
    placement = "placement"


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Nullable: class sessions have class_id; playground sessions have topic_id; placement has neither
    class_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("classes.id", ondelete="SET NULL"), nullable=True
    )
    topic_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("playground_topics.id", ondelete="SET NULL"), nullable=True
    )
    session_type: Mapped[SessionType] = mapped_column(
        Enum(SessionType, name="session_type_enum", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    transcript_json: Mapped[Any] = mapped_column(JSON, nullable=True)
    summary_json: Mapped[Any] = mapped_column(JSON, nullable=True)
    xp_awarded: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    skill_scores: Mapped[list["SkillScore"]] = relationship(
        "SkillScore", back_populates="session", lazy="raise"
    )


class SkillScore(Base):
    __tablename__ = "skill_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    skill: Mapped[SkillType] = mapped_column(
        Enum(SkillType, name="skill_type_enum"), nullable=False
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)  # 0–100
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    session: Mapped[Session] = relationship("Session", back_populates="skill_scores", lazy="raise")
