from sqlalchemy import Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKey


class PlaygroundTopic(UUIDPrimaryKey, Base):
    __tablename__ = "playground_topics"

    slug: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    difficulty_band: Mapped[float | None] = mapped_column(Float, nullable=True)
