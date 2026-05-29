"""Fold one analysis_results row into student_grammar_weaknesses.

Called from the Celery task (sync context) after analysis lands.
Idempotent: the caller guards with a last_aggregated_analysis_id check
or simply relies on the upsert math being monotone (frequency only rises).
"""
import logging
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.orm import Session as SyncSession

logger = logging.getLogger(__name__)

# Default severity when not present in analysis output
_DEFAULT_SEVERITY = 2.0


def aggregate(db: SyncSession, student_id: UUID, analysis_result) -> None:
    """Upsert grammar weaknesses from a single AnalysisResult.

    grammar_mistakes format expected from Phase 1:
      [{"category": "past_tense", "severity": "medium", "original": ..., ...}, ...]
    severity string map: low=1, medium=2, high=3 (default 2)
    """
    from app.db.models.grammar import StudentGrammarWeakness

    raw_mistakes = analysis_result.grammar_mistakes or []
    if not raw_mistakes:
        return

    # Group by category: sum frequency, avg severity
    category_data: dict[str, dict] = {}
    for mistake in raw_mistakes:
        if not isinstance(mistake, dict):
            continue
        cat = str(mistake.get("category", "general")).lower().strip()
        sev_raw = str(mistake.get("severity", "medium")).lower()
        sev_val = {"low": 1.0, "medium": 2.0, "high": 3.0}.get(sev_raw, _DEFAULT_SEVERITY)
        freq = int(mistake.get("frequency", 1))

        if cat not in category_data:
            category_data[cat] = {"frequency": 0, "severity_sum": 0.0, "count": 0}
        category_data[cat]["frequency"] += freq
        category_data[cat]["severity_sum"] += sev_val
        category_data[cat]["count"] += 1

    for cat, data in category_data.items():
        session_severity = data["severity_sum"] / data["count"] if data["count"] else _DEFAULT_SEVERITY
        try:
            existing = db.execute(
                select(StudentGrammarWeakness).where(
                    and_(
                        StudentGrammarWeakness.student_id == student_id,
                        StudentGrammarWeakness.category == cat,
                    )
                )
            ).scalar_one_or_none()

            if existing:
                n = existing.times_seen
                existing.frequency += data["frequency"]
                # Rolling average severity
                existing.severity = round((existing.severity * n + session_severity) / (n + 1), 2)
                existing.times_seen = n + 1
            else:
                db.add(StudentGrammarWeakness(
                    student_id=student_id,
                    category=cat,
                    frequency=data["frequency"],
                    severity=round(session_severity, 2),
                    times_seen=1,
                ))
        except Exception as exc:
            logger.warning("grammar.aggregator: failed for category %s: %s", cat, exc)

    db.flush()
