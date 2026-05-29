"""Band-appropriate target vocabulary lists for word unlock introduction.

v1: static lists. Future: Nova Lite upgrade-suggestion hook.
"""
from typing import NamedTuple


class TargetWord(NamedTuple):
    word: str
    meaning: str


# Band buckets: 2-3 (beginner), 3-5 (elementary-pre-int), 5-7 (intermediate-upper), 7-9 (advanced)
_BAND_WORDS: dict[str, list[TargetWord]] = {
    "beginner": [
        TargetWord("useful", "helpful or practical"),
        TargetWord("common", "happening often or shared by many"),
        TargetWord("opinion", "what you think about something"),
        TargetWord("describe", "to say what something is like"),
        TargetWord("prefer", "to like one thing more than another"),
        TargetWord("explain", "to make something clear"),
        TargetWord("consider", "to think carefully about"),
    ],
    "intermediate": [
        TargetWord("significant", "important or noticeable"),
        TargetWord("challenge", "a difficult task or problem"),
        TargetWord("perspective", "a way of thinking about something"),
        TargetWord("impact", "an effect or influence"),
        TargetWord("achieve", "to succeed in doing something"),
        TargetWord("demonstrate", "to show or prove"),
        TargetWord("beneficial", "having a good or helpful effect"),
        TargetWord("essential", "absolutely necessary"),
    ],
    "advanced": [
        TargetWord("sophisticated", "developed or complex in nature"),
        TargetWord("nuanced", "having subtle distinctions"),
        TargetWord("sustainable", "able to continue without harm"),
        TargetWord("pivotal", "of crucial importance"),
        TargetWord("articulate", "to express clearly and fluently"),
        TargetWord("scrutinise", "to examine very closely"),
        TargetWord("implication", "a likely consequence"),
        TargetWord("compelling", "very convincing or interesting"),
    ],
}


def get_candidates(band: float | None) -> list[TargetWord]:
    """Return target words appropriate for this IELTS band."""
    if band is None or band < 4.0:
        return _BAND_WORDS["beginner"]
    if band < 6.0:
        return _BAND_WORDS["intermediate"]
    return _BAND_WORDS["advanced"]
