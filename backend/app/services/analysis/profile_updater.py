"""Upsert student_learning_profiles with rolling weighted averages."""
import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session as SyncSession

from app.db.models.learning import StudentLearningProfile

logger = logging.getLogger(__name__)

# Weight for the new session vs existing rolling average (exponential moving avg)
_EMA_ALPHA = 0.3


def _ema(current: float | None, new_value: float) -> float:
    """Exponential moving average: blend new_value into current."""
    if current is None:
        return new_value
    return round(_EMA_ALPHA * new_value + (1 - _EMA_ALPHA) * current, 2)


def _merge_list(existing: list[str] | None, new_items: list[str], max_items: int = 10) -> list[str]:
    """Merge new items into existing list, deduplicated, capped at max_items."""
    combined = list(dict.fromkeys((existing or []) + (new_items or [])))
    return combined[:max_items]


def _merge_mistake_frequencies(
    existing: dict | None, grammar_mistakes: list[dict]
) -> dict:
    """Increment category counters from new grammar mistakes."""
    freq = dict(existing or {})
    for mistake in grammar_mistakes:
        cat = mistake.get("category", "other")
        freq[cat] = freq.get(cat, 0) + 1
    return freq


def _merge_vocab_mastery(
    existing: dict | None, vocab_usage: list[dict]
) -> dict:
    """Accumulate mastery signals per word (emerging=+1, developing=+2, secure=+3)."""
    mastery = dict(existing or {})
    signal_weights = {"emerging": 1, "developing": 2, "secure": 3}
    for entry in vocab_usage:
        word = entry.get("word", "")
        signal = entry.get("mastery_signal", "emerging")
        if word and entry.get("used_correctly"):
            mastery[word] = mastery.get(word, 0) + signal_weights.get(signal, 1)
    return mastery


def upsert_profile(
    db: SyncSession,
    student_id: UUID,
    analysis: dict,
    pre_metrics: dict,
) -> StudentLearningProfile:
    """Update or create StudentLearningProfile from a new analysis result.

    Uses EMA for band estimates, merge-and-cap for lists.
    """
    profile = db.execute(
        select(StudentLearningProfile).where(
            StudentLearningProfile.student_id == student_id
        )
    ).scalar_one_or_none()

    band = analysis.get("band_estimate", {})
    grammar_mistakes = analysis.get("grammar_mistakes", [])
    vocab_usage = analysis.get("vocab_usage", [])
    strengths = analysis.get("strengths", [])
    weaknesses = analysis.get("weaknesses", [])

    if profile is None:
        profile = StudentLearningProfile(
            student_id=student_id,
            fluency_band=band.get("fluency"),
            grammar_band=band.get("grammar"),
            vocabulary_band=band.get("vocabulary"),
            overall_band=band.get("overall"),
            strengths=strengths[:10],
            weaknesses=weaknesses[:10],
            mistake_frequencies=_merge_mistake_frequencies(None, grammar_mistakes),
            vocab_mastery=_merge_vocab_mastery(None, vocab_usage),
            sessions_analyzed=1,
        )
        db.add(profile)
    else:
        profile.fluency_band = _ema(profile.fluency_band, band.get("fluency") or 0)
        profile.grammar_band = _ema(profile.grammar_band, band.get("grammar") or 0)
        profile.vocabulary_band = _ema(profile.vocabulary_band, band.get("vocabulary") or 0)
        profile.overall_band = _ema(profile.overall_band, band.get("overall") or 0)
        profile.strengths = _merge_list(profile.strengths, strengths)
        profile.weaknesses = _merge_list(profile.weaknesses, weaknesses)
        profile.mistake_frequencies = _merge_mistake_frequencies(
            profile.mistake_frequencies, grammar_mistakes
        )
        profile.vocab_mastery = _merge_vocab_mastery(profile.vocab_mastery, vocab_usage)
        profile.sessions_analyzed = (profile.sessions_analyzed or 0) + 1

    db.flush()
    logger.info(
        "profile_updater: student=%s sessions=%d overall_band=%.1f",
        student_id, profile.sessions_analyzed, profile.overall_band or 0,
    )
    return profile
