"""Extract long-term-useful student facts from session transcript via Nova Lite."""
import logging

from app.services.analysis import nova_client

logger = logging.getLogger(__name__)

# Allowed memory types — strict allow-list; anything else dropped
ALLOWED_TYPES = frozenset({
    "name", "job", "country", "family", "hobby",
    "interest", "goal", "target_band", "study_reason",
})

# Markers that suggest sensitive data — drop any memory value containing these
_SENSITIVE_MARKERS = (
    "password", "card number", "credit", "debit", "account number",
    "ssn", "passport", "bank", "health", "medical", "diagnosis",
    "address", "phone number", "email", "salary",
)

_EXTRACTION_SYSTEM_PROMPT = """You extract long-term personal facts from English learning session transcripts.

Output ONLY valid JSON in this exact format:
{
  "memories": [
    {"type": "job", "value": "Software Engineer", "confidence": 85},
    {"type": "target_band", "value": "7.0", "confidence": 92}
  ]
}

Allowed types: name, job, country, family, hobby, interest, goal, target_band, study_reason.

Rules:
- Only include facts the student stated about THEMSELVES.
- REFUSE to extract: passwords, financial data, health info, contact info, addresses, account numbers.
- Set confidence 0-100 based on how clearly the student stated the fact.
- If nothing useful is found, return {"memories": []}.
- Never invent facts; only extract what was explicitly stated."""


def extract(transcript_text: str, student_id_str: str) -> list[dict]:
    """Extract memory facts from transcript text.

    Returns list of {type, value, confidence} dicts.
    Safe to call from Celery sync context.
    Returns empty list on any error — never raises.
    """
    if not transcript_text or len(transcript_text.strip()) < 50:
        return []
    try:
        raw = nova_client.analyze_transcript(
            transcript_text,
            system_prompt=_EXTRACTION_SYSTEM_PROMPT,
        )
        memories = raw.get("memories", [])
        return _filter_memories(memories)
    except Exception as exc:
        logger.warning(
            "memory_extractor: extraction failed for student %s: %s",
            student_id_str, exc,
        )
        return []


def _filter_memories(raw_list: list) -> list[dict]:
    """Apply allow-list + sensitive-data filter."""
    clean: list[dict] = []
    for item in raw_list:
        if not isinstance(item, dict):
            continue
        type_ = str(item.get("type", "")).lower().strip()
        value = str(item.get("value", "")).strip()
        confidence = int(item.get("confidence", 0))
        if type_ not in ALLOWED_TYPES:
            continue
        if not value:
            continue
        value_lower = value.lower()
        if any(marker in value_lower for marker in _SENSITIVE_MARKERS):
            logger.info("memory_extractor: dropped sensitive value for type=%s", type_)
            continue
        clean.append({
            "type": type_,
            "value": value,
            "confidence": min(100, max(0, confidence)),
        })
    return clean
