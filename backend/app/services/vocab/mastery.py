"""Pure mastery score delta functions for vocabulary tracking."""

_CAP = 100.0
WORD_UNLOCK_MASTERY = 80.0


def new_word_delta() -> float:
    """First time a word is seen."""
    return 20.0


def repeated_use_delta() -> float:
    """Seen again in same context (same topic/session)."""
    return 5.0


def new_context_delta() -> float:
    """Used in a new context (different session or topic)."""
    return 15.0


def apply_delta(current: float, delta: float) -> float:
    return min(_CAP, current + delta)


def mastered_jump(current: float) -> float:
    """When word unlock is confirmed — jump to at least WORD_UNLOCK_MASTERY."""
    return max(current, WORD_UNLOCK_MASTERY)
