"""Convert transcript_json to compact text + compute fluency metrics from turn timestamps."""
import logging
import re

logger = logging.getLogger(__name__)

# Token cap: keep transcript under ~3k words to stay comfortably within Nova's context
_MAX_WORDS = 3000


def serialize(transcript: dict) -> tuple[str, dict]:
    """Serialize transcript_json to compact text and compute pre-analysis fluency metrics.

    Returns:
        (text_for_nova, fluency_pre_metrics)

    fluency_pre_metrics keys: wpm (float|None), total_turns, student_turns, avg_student_words
    """
    turns: list[dict] = transcript.get("turns", [])
    if not turns:
        return "", {"wpm": None, "total_turns": 0, "student_turns": 0, "avg_student_words": 0.0}

    lines: list[str] = []
    word_count = 0
    student_word_counts: list[int] = []
    timestamps: list[float] = []

    for turn in turns:
        role = turn.get("role", "").upper()
        text = turn.get("text", "").strip()
        ts = turn.get("ts")  # ISO-8601 string or ms-since-start int/float

        if not text:
            continue

        label = "STUDENT" if role == "USER" else "TUTOR"
        line = f"{label}: {text}"
        new_words = len(re.findall(r"\w+", text))

        if word_count + new_words > _MAX_WORDS:
            lines.append("[... remaining turns truncated for length ...]")
            break

        # Turn is kept — collect timestamp only after confirming inclusion
        if ts is not None:
            try:
                timestamps.append(float(ts))
            except (TypeError, ValueError):
                pass

        lines.append(line)
        word_count += new_words

        if role == "USER":
            student_word_counts.append(new_words)

    # Compute wpm from timestamps (ms-since-start or epoch ms — only relative diff matters)
    wpm: float | None = None
    if len(timestamps) >= 2 and word_count > 0:
        duration_ms = timestamps[-1] - timestamps[0]
        if duration_ms > 0:
            duration_min = duration_ms / 60_000
            wpm = round(word_count / duration_min, 1)

    avg_student_words = (
        round(sum(student_word_counts) / len(student_word_counts), 1)
        if student_word_counts else 0.0
    )

    text_output = "\n".join(lines)
    pre_metrics = {
        "wpm": wpm,
        "total_turns": len(turns),
        "student_turns": len(student_word_counts),
        "avg_student_words": avg_student_words,
    }
    return text_output, pre_metrics
