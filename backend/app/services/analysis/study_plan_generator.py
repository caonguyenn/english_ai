"""Generate a structured study plan from the latest learning profile."""
import logging

from app.db.models.learning import StudentLearningProfile

logger = logging.getLogger(__name__)

# Max items surfaced in any plan section
_MAX_FOCUS_ITEMS = 3


def _band_to_target(band: float | None) -> float:
    """Return target band: current + 0.5, capped at 9.0."""
    if band is None:
        return 5.0
    return min(round(band + 0.5, 1), 9.0)


def _top_mistakes(frequencies: dict | None, n: int = _MAX_FOCUS_ITEMS) -> list[str]:
    if not frequencies:
        return []
    return sorted(frequencies, key=lambda k: frequencies[k], reverse=True)[:n]


def _top_vocab_gaps(mastery: dict | None, n: int = _MAX_FOCUS_ITEMS) -> list[str]:
    """Words with lowest cumulative mastery score — most in need of practice."""
    if not mastery:
        return []
    return sorted(mastery, key=lambda k: mastery[k])[:n]


def generate(profile: StudentLearningProfile) -> dict:
    """Build a study plan JSON from the student's learning profile.

    Returns a dict ready to store in StudyPlan.generated_plan.
    """
    weaknesses = (profile.weaknesses or [])[:_MAX_FOCUS_ITEMS]
    grammar_focus = _top_mistakes(profile.mistake_frequencies)
    vocab_gaps = _top_vocab_gaps(profile.vocab_mastery)

    current_band = profile.overall_band
    target_band = _band_to_target(current_band)

    plan = {
        "current_band": current_band,
        "target_band": target_band,
        "sessions_analyzed": profile.sessions_analyzed,
        "focus_areas": {
            "grammar": grammar_focus or weaknesses[:2],
            "vocabulary": vocab_gaps,
            "skills": weaknesses,
        },
        "recommended_session_types": _recommend_types(profile),
        "daily_practice": _daily_tips(grammar_focus, vocab_gaps, profile.overall_band),
    }

    logger.info(
        "study_plan_generator: student=%s band=%.1f→%.1f focus=%s",
        profile.student_id, current_band or 0, target_band, grammar_focus,
    )
    return plan


def _recommend_types(profile: StudentLearningProfile) -> list[str]:
    types: list[str] = []
    grammar_band = profile.grammar_band or 0
    vocab_band = profile.vocabulary_band or 0
    fluency_band = profile.fluency_band or 0

    if grammar_band < 6:
        types.append("grammar class")
    if vocab_band < 6:
        types.append("vocabulary class")
    if fluency_band < 6:
        types.append("speaking class")
    if not types:
        types.append("playground conversation")
    return types[:3]


def _daily_tips(grammar_focus: list[str], vocab_gaps: list[str], band: float | None) -> list[str]:
    tips: list[str] = []
    if grammar_focus:
        tips.append(f"Practice {grammar_focus[0]} in 3 sentences daily")
    if vocab_gaps:
        tips.append(f"Use '{vocab_gaps[0]}' in conversation this week")
    if band and band < 5:
        tips.append("Focus on speaking longer answers (aim for 3+ sentences per response)")
    elif band and band < 7:
        tips.append("Add discourse markers (however, therefore, in contrast) to link ideas")
    else:
        tips.append("Challenge yourself with abstract topics and complex argumentation")
    return tips
