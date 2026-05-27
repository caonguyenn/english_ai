"""System prompt assembly for NovaSonic sessions.

Fetches real student context from the REST API:
  - student profile + XP
  - module info (band, title)
  - last 3 session summaries (condensed — never raw transcripts)
  - weakness tags from progress endpoint

Falls back to a static prompt on any HTTP error so sessions are never blocked.
"""
import asyncio
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

REST_BASE = settings.REST_BASE_URL

_STATIC_FALLBACK = (
    "You are an expert English teacher and conversation coach. "
    "Help the student improve their spoken English through natural conversation. "
    "Gently correct grammar, vocabulary, and pronunciation mistakes. "
    "Keep responses concise and spoken-friendly: short sentences, no bullet points, no markdown."
)


async def build_system_prompt(
    session_type: str,
    ref_id: int | None,
    token: str,
) -> str:
    """Build a NovaSonic system prompt with real student context.

    Args:
        session_type: 'class' | 'playground' | 'placement'
        ref_id: class_id or topic_id (None for placement)
        token: student's Cognito AccessToken — used for REST calls

    Returns:
        Full system prompt string.
    """
    try:
        return await _build_with_context(session_type, ref_id, token)
    except Exception as exc:
        logger.warning(
            "prompt_builder: failed to fetch student context (%s) — using fallback",
            exc,
        )
        return _static_fallback(session_type)


async def _build_with_context(
    session_type: str,
    ref_id: int | None,
    token: str,
) -> str:
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(base_url=REST_BASE, timeout=3.0) as client:
        # Profile first — need student.id for subsequent calls
        me_resp = await client.get("/auth/me", headers=headers)
        me_resp.raise_for_status()
        student: dict = me_resp.json()

        student_id = student["id"]

        # Fetch progress + history in parallel
        progress_resp, history_resp = await asyncio.gather(
            client.get(f"/students/{student_id}/progress", headers=headers),
            client.get(f"/students/{student_id}/history?limit=3", headers=headers),
            return_exceptions=True,
        )

        progress: dict = {}
        if not isinstance(progress_resp, Exception) and progress_resp.status_code == 200:
            progress = progress_resp.json()

        summaries: list[dict] = []
        if not isinstance(history_resp, Exception) and history_resp.status_code == 200:
            history_data: list[dict] = history_resp.json()
            summaries = [
                s["summary_json"]
                for s in history_data
                if s.get("summary_json")
            ]

        # Fetch module + class info in parallel (when applicable)
        module_info = ""
        class_info = ""
        topic_title = ""

        module_task = (
            client.get(f"/modules/{student['current_module_id']}", headers=headers)
            if student.get("current_module_id")
            else None
        )
        class_task = (
            client.get(f"/classes/{ref_id}", headers=headers)
            if session_type == "class" and ref_id
            else None
        )
        topic_task = (
            client.get(f"/playground/topics", headers=headers)
            if session_type == "playground" and ref_id
            else None
        )

        tasks = [t for t in [module_task, class_task, topic_task] if t is not None]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        result_idx = 0
        if module_task is not None:
            mod_result = results[result_idx]
            result_idx += 1
            if (
                not isinstance(mod_result, Exception)
                and mod_result.status_code == 200
            ):
                mod = mod_result.json()
                module_info = (
                    f"The student is in the '{mod['title']}' module "
                    f"(IELTS band {mod['band_min']}–{mod['band_max']}). "
                )

        if class_task is not None:
            cls_result = results[result_idx]
            result_idx += 1
            if (
                not isinstance(cls_result, Exception)
                and cls_result.status_code == 200
            ):
                cls = cls_result.json()
                class_info = (
                    f"This is a {cls['skill_type']} class: '{cls['title']}'. "
                    f"{cls.get('description', '')} "
                    f"{cls.get('system_prompt_addendum', '')}"
                ).strip()

        if topic_task is not None:
            topics_result = results[result_idx]
            if (
                not isinstance(topics_result, Exception)
                and topics_result.status_code == 200
            ):
                topics_data: list[dict] = topics_result.json()
                matched = next(
                    (t for t in topics_data if t["id"] == ref_id), None
                )
                if matched:
                    topic_title = matched["title"]

    # ── Assemble prompt ──────────────────────────────────────────────────────
    name = student.get("name") or "there"
    xp = student.get("xp_total", 0)
    prompt = (
        f"You are an expert English teacher. "
        f"The student's name is {name}. "
        f"Their total XP is {xp}. "
        f"{module_info}"
    )

    weak_areas: list[str] = progress.get("weak_areas", [])
    if weak_areas:
        prompt += f"Focus improvement areas: {', '.join(weak_areas)}. "

    # Inject last 3 summaries — capped and bracketed to prevent prompt injection
    if summaries:
        prompt += "Recent session context: "
        for i, summary in enumerate(summaries[:3], 1):
            if isinstance(summary, dict):
                text = str(summary.get("summary", ""))[:500]
            else:
                text = str(summary)[:500]
            prompt += f"[Session {i} summary: {text}] "

    # Session-type specific instructions
    if session_type == "placement":
        prompt += (
            "You are conducting an English placement assessment. "
            "Ask 6–8 questions of increasing difficulty to assess the student's IELTS band. "
            "Cover: basic conversation, describing experiences, opinions on abstract topics, "
            "complex argumentation. "
            "Do NOT reveal the student's score during the assessment. "
            "At the end, use record_skill_score for each skill area assessed."
        )
    elif session_type == "playground":
        if topic_title:
            prompt += f"This is a free conversation about: {topic_title}. "
        prompt += (
            "Let the student lead the conversation. "
            "Gently correct mistakes. Keep it natural and encouraging."
        )
    elif session_type == "class":
        prompt += class_info

    # Tool usage instructions
    prompt += (
        " Use record_skill_score at the end of the session for each skill practiced. "
        "Use trigger_level_up ONLY when you are confident the student has mastered "
        "the entire module (requires strong performance across multiple sessions)."
    )

    # Output format
    prompt += (
        " Keep all responses concise and spoken-friendly: "
        "short sentences, no bullet points, no markdown."
    )

    return prompt


def _static_fallback(session_type: str) -> str:
    """Return a static fallback prompt when REST API is unavailable."""
    if session_type == "placement":
        return (
            "You are conducting an English placement assessment. "
            "Ask 6–8 questions of increasing difficulty. "
            "Cover: basic conversation, opinions, and complex argumentation. "
            "At the end, call record_skill_score for each skill area. "
            "Keep responses short and spoken-friendly."
        )
    if session_type == "playground":
        return _STATIC_FALLBACK + " This is a free conversation — let the student choose the topic."
    return _STATIC_FALLBACK + " This is a structured lesson. Focus on teaching and guided practice."
