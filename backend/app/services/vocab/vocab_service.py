"""Vocabulary usage aggregation — called from Celery (sync) after Phase 1 analysis."""
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.orm import Session as SyncSession

from app.services.vocab.mastery import apply_delta, new_context_delta, new_word_delta

logger = logging.getLogger(__name__)


def upsert_usage(db: SyncSession, student_id: UUID, analysis_result) -> None:
    """Fold vocab_usage from one analysis_results row into student_vocabulary.

    Idempotent: usage_count and mastery only increase; no double-award.
    Called synchronously from the Celery task.
    """
    from app.db.models.vocab import StudentVocabulary

    raw_vocab = analysis_result.vocab_usage or []
    if not raw_vocab:
        return

    now = datetime.now(tz=timezone.utc)

    for item in raw_vocab:
        if not isinstance(item, dict):
            continue
        word = str(item.get("word", "")).lower().strip()
        if not word:
            continue
        freq = max(1, int(item.get("frequency", 1)))

        try:
            existing = db.execute(
                select(StudentVocabulary).where(
                    and_(
                        StudentVocabulary.student_id == student_id,
                        StudentVocabulary.word == word,
                    )
                )
            ).scalar_one_or_none()

            if existing:
                existing.usage_count += freq
                existing.last_used_at = now
                # new-context delta (different session → higher delta)
                existing.mastery_score = apply_delta(existing.mastery_score, new_context_delta())
            else:
                db.add(StudentVocabulary(
                    student_id=student_id,
                    word=word,
                    usage_count=freq,
                    mastery_score=new_word_delta(),
                    first_seen_at=now,
                    last_used_at=now,
                ))
        except Exception as exc:
            logger.warning("vocab_service.upsert_usage: failed for word '%s': %s", word, exc)

    db.flush()
