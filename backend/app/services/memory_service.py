"""Memory CRUD — sync for Celery tasks, async for routes."""
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.orm import Session as SyncSession

logger = logging.getLogger(__name__)


def upsert_many_sync(
    db: SyncSession,
    student_id: UUID,
    session_id: UUID | None,
    facts: list[dict],
) -> None:
    """Upsert memory facts (sync — for Celery tasks).

    On duplicate (student_id, memory_type, memory_value): keeps the higher
    confidence score and refreshes updated_at. Swallows per-fact errors so
    a single bad fact does not abort the whole batch.
    """
    from app.db.models.memory import StudentMemory

    for fact in facts:
        type_ = fact.get("type", "")
        value = fact.get("value", "").lower().strip()
        confidence = int(fact.get("confidence", 0))
        if not type_ or not value:
            continue
        try:
            existing = db.execute(
                select(StudentMemory).where(
                    and_(
                        StudentMemory.student_id == student_id,
                        StudentMemory.memory_type == type_,
                        StudentMemory.memory_value == value,
                    )
                )
            ).scalar_one_or_none()
            if existing:
                existing.confidence_score = max(existing.confidence_score, confidence)
                existing.updated_at = datetime.now(tz=timezone.utc)
            else:
                db.add(StudentMemory(
                    student_id=student_id,
                    memory_type=type_,
                    memory_value=value,
                    confidence_score=confidence,
                    source_session_id=session_id,
                ))
        except Exception as exc:
            logger.warning(
                "memory_service.upsert_many_sync: failed for %s/%s: %s",
                type_, value[:30], exc,
            )
    db.flush()
