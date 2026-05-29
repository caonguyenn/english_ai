from uuid import UUID

import uuid_utils
from sqlalchemy import Uuid
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def _uuid7() -> UUID:
    """Generate a UUIDv7 as stdlib UUID (time-ordered, index-friendly)."""
    return UUID(str(uuid_utils.uuid7()))


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""


class UUIDPrimaryKey:
    """Mixin that adds a UUIDv7 primary key column named `id`."""

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=_uuid7)
