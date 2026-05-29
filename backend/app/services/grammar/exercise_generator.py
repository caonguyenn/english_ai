"""Generate MCQ grammar exercises via Nova Lite."""
import logging
from typing import Any

from pydantic import BaseModel, ValidationError

from app.services.grammar.exercise_prompt import DEFAULT_FALLBACK, EXERCISE_GENERATION_PROMPT, FALLBACK_EXERCISES

logger = logging.getLogger(__name__)


class GrammarExercisePayload(BaseModel):
    category: str
    prompt: str
    options: dict[str, str]  # {"A":..., "B":..., "C":..., "D":...}
    answer: str
    explanation: str


def generate(category: str, band: float | None = None) -> GrammarExercisePayload:
    """Generate one MCQ for the given category. Falls back to a template on Nova failure."""
    user_message = f"Generate one MCQ grammar exercise for category: {category}"
    if band is not None:
        user_message += f", IELTS band: {band:.1f}"

    try:
        from app.services.analysis.nova_client import analyze_transcript
        raw = analyze_transcript(user_message, system_prompt=EXERCISE_GENERATION_PROMPT)
        return GrammarExercisePayload.model_validate(raw)
    except (ValidationError, Exception) as exc:
        logger.warning("exercise_generator: Nova failed for %s, retrying: %s", category, exc)

    # Retry once
    try:
        from app.services.analysis.nova_client import analyze_transcript
        raw = analyze_transcript(user_message, system_prompt=EXERCISE_GENERATION_PROMPT)
        return GrammarExercisePayload.model_validate(raw)
    except Exception as exc:
        logger.error("exercise_generator: retry failed for %s, using fallback: %s", category, exc)

    fallback = FALLBACK_EXERCISES.get(category, DEFAULT_FALLBACK)
    return GrammarExercisePayload.model_validate(fallback)
