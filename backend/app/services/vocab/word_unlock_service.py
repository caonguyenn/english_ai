"""Word unlock — pick target words, create unlock rows, detect reuse, award XP."""
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.orm import Session as SyncSession

from app.services.vocab.mastery import mastered_jump
from app.services.vocab.target_words import TargetWord, get_candidates

logger = logging.getLogger(__name__)

WORD_UNLOCK_XP = 20


def detect_and_award(
    db: SyncSession,
    student_id: UUID,
    analysis_result,
) -> list[str]:
    """For unlocked words with used_at NULL that appear in session's vocab_usage,
    set used_at, award +20 XP (idempotent), mark mastery as mastered.

    Returns list of newly-awarded word strings.
    """
    from app.db.models.vocab import StudentVocabulary, WordUnlock
    from app.db.models.student import Student

    raw_vocab = analysis_result.vocab_usage or []
    words_used = {
        str(item.get("word", "")).lower().strip()
        for item in raw_vocab
        if isinstance(item, dict) and item.get("word")
    }
    if not words_used:
        return []

    # Find unlocked words that haven't been used yet
    pending_unlocks = db.execute(
        select(WordUnlock).where(
            and_(
                WordUnlock.student_id == student_id,
                WordUnlock.used_at == None,  # noqa: E711
            )
        )
    ).scalars().all()

    awarded: list[str] = []
    now = datetime.now(tz=timezone.utc)

    for unlock in pending_unlocks:
        if unlock.word.lower() not in words_used:
            continue
        # Award XP (idempotent — used_at was NULL)
        unlock.used_at = now
        unlock.xp_awarded = WORD_UNLOCK_XP

        # Update student XP
        student = db.execute(select(Student).where(Student.id == student_id)).scalar_one_or_none()
        if student:
            student.xp_total = (student.xp_total or 0) + WORD_UNLOCK_XP

        # Bump mastery to mastered level
        vocab = db.execute(
            select(StudentVocabulary).where(
                and_(
                    StudentVocabulary.student_id == student_id,
                    StudentVocabulary.word == unlock.word.lower(),
                )
            )
        ).scalar_one_or_none()
        if vocab:
            vocab.mastery_score = mastered_jump(vocab.mastery_score)

        awarded.append(unlock.word)

    if awarded:
        db.flush()
        logger.info(
            "word_unlock: awarded +%d XP for %d words: %s",
            WORD_UNLOCK_XP * len(awarded), len(awarded), awarded,
        )

    return awarded


def pick_and_create_unlocks(
    db: SyncSession,
    student_id: UUID,
    session_id: UUID,
    band: float | None,
    n: int = 3,
) -> list[str]:
    """Choose up to n target words not yet mastered, create WordUnlock rows.

    Returns list of chosen words (for injection into prompt).
    """
    from app.db.models.vocab import StudentVocabulary, WordUnlock

    candidates: list[TargetWord] = get_candidates(band)

    # Get words already mastered (mastery >= 80)
    mastered_result = db.execute(
        select(StudentVocabulary.word).where(
            and_(
                StudentVocabulary.student_id == student_id,
                StudentVocabulary.mastery_score >= 80.0,
            )
        )
    ).scalars().all()
    mastered_words = set(mastered_result)

    # Get words already introduced but not yet used (pending)
    pending_result = db.execute(
        select(WordUnlock.word).where(
            and_(
                WordUnlock.student_id == student_id,
                WordUnlock.used_at == None,  # noqa: E711
            )
        )
    ).scalars().all()
    pending_words = set(pending_result)

    chosen: list[TargetWord] = []
    for candidate in candidates:
        if len(chosen) >= n:
            break
        if candidate.word.lower() in mastered_words:
            continue
        if candidate.word.lower() in pending_words:
            continue
        chosen.append(candidate)

    now = datetime.now(tz=timezone.utc)
    for tw in chosen:
        db.add(WordUnlock(
            student_id=student_id,
            session_id=session_id,
            word=tw.word.lower(),
            introduced_at=now,
        ))
    if chosen:
        db.flush()

    return [tw.word for tw in chosen]
