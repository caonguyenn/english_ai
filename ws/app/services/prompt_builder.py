"""System prompt assembly for NovaSonic sessions.

Fetches real student context from the REST API (profile, progress, last-1 summary,
student memories) and assembles a personalised NovaSonic system prompt.
Falls back to a static prompt on any HTTP error so sessions are never blocked.
"""
import asyncio
import logging

import httpx

from app.config import settings
from app.services.prompt_mock_test import mock_test_prompt
from app.services.prompt_constants import (
    PLACEMENT_FALLBACK_INSTRUCTIONS,
    PLACEMENT_INSTRUCTIONS,
    STATIC_FALLBACK,
    _CORRECTION_STYLE,
    _OUTPUT_STYLE,
    _PERSONA,
)

logger = logging.getLogger(__name__)
REST_BASE = f"{settings.REST_BASE_URL}/api/v1"


# ── Section builders ──────────────────────────────────────────────────────────

def _band_guidance(band_min: float | None, band_max: float | None) -> str:
    if band_min is None:
        return ""
    avg = (band_min + (band_max if band_max is not None else band_min)) / 2
    if avg < 4.0:
        return (
            "Pitch your language to a BEGINNER level: use simple, high-frequency vocabulary "
            "and short sentences. Speak slowly and clearly. Ask one easy question at a time, "
            "give plenty of encouragement, and offer the word or phrase if the student gets stuck. "
        )
    if avg < 6.0:
        return (
            "Pitch your language to an INTERMEDIATE level: use everyday vocabulary with some "
            "less common words, and moderately complex sentences. Encourage the student to expand "
            "their answers with reasons and examples, and introduce useful new phrases naturally. "
        )
    return (
        "Pitch your language to an ADVANCED level: use rich vocabulary, idioms, and natural pace. "
        "Push the student toward abstract topics, nuanced opinions, and well-structured argumentation. "
        "Challenge them to refine precision, fluency, and sophistication. "
    )


def _skill_focus(skill_type: str) -> str:
    return {
        "speaking": "Prioritise fluency and confidence — keep the student talking as much as possible.",
        "listening": "Speak a little more and have the student respond to what they heard; check comprehension.",
        "grammar": "Gently focus corrections on sentence structure and verb forms relevant to this level.",
        "pronunciation": "Pay close attention to pronunciation; model tricky sounds and have the student repeat.",
        "vocabulary": "Introduce and reinforce useful new words and phrases, prompting the student to use them.",
    }.get(skill_type, "")


def _memory_section(name: str, memories: list[dict]) -> str:
    """Inject up to MEMORY_INJECT_MAX_COUNT long-term student facts."""
    if not memories:
        return ""
    max_count: int = getattr(settings, "MEMORY_INJECT_MAX_COUNT", 8)
    mem_lines = "; ".join(
        f"{m['memory_type']}={m['memory_value']}" for m in memories[:max_count]
    )
    return (
        f"Here is what you remember about {name}: {mem_lines}. "
        "When relevant, refer to these naturally in conversation — "
        "for example: 'Last time you mentioned you work as a DevOps engineer...'. "
        "Never recite the list directly. "
    )


def _word_unlock_section(words: list[dict]) -> str:
    """Inject target words for the AI to introduce naturally during the session."""
    if not words:
        return ""
    word_list = ", ".join(w["word"] for w in words)
    return (
        f"During this session, naturally introduce and encourage use of these target words: {word_list}. "
        "Weave them into conversation organically — don't list them or announce 'here is a new word'. "
        "When the student uses one of these words correctly, give genuine, specific praise. "
    )


def _session_type_block(
    session_type: str,
    band_min: float | None,
    band_max: float | None,
    skill_type: str,
    class_info: str,
    topic_title: str,
) -> str:
    if session_type == "mock_test":
        return mock_test_prompt()
    if session_type == "placement":
        return PLACEMENT_INSTRUCTIONS
    if session_type == "playground":
        topic_line = f"This is a relaxed, free-flowing conversation about: {topic_title}. " if topic_title else ""
        return (
            topic_line
            + "Let the student lead and take the conversation where they like. "
            "Your role is to keep it flowing with genuine curiosity, ask engaging follow-up questions, "
            "and help them express themselves more fully. "
            + _CORRECTION_STYLE
        )
    # class
    return (
        "This is a structured lesson, and YOU lead it. Open with a warm greeting and a clear, "
        "simple statement of what you'll practice together today, then guide the student through "
        "focused practice with engaging prompts and questions. Keep them actively speaking — "
        "do not lecture or monologue. "
        + _band_guidance(band_min, band_max)
        + _skill_focus(skill_type) + " "
        + class_info + " "
        + _CORRECTION_STYLE
        + "Aim for roughly 5–8 good exchanges that genuinely practice this skill. "
        "When the student has had solid, meaningful practice and you judge the lesson objective met, "
        "wrap up: briefly praise their specific progress, tell them they've completed the lesson, "
        "then (see tool instructions below) record their scores and complete the class. "
    )


def _tool_instructions(session_type: str) -> str:
    if session_type == "mock_test":
        # Mock tests are scored post-session by the analysis engine — no tool calls during exam.
        return ""
    if session_type == "class":
        return (
            "TOOLS — at the end of the lesson, in this exact order: "
            "(1) Call record_skill_score once for each skill you meaningfully practiced "
            "(at minimum this class's skill), with a fair 0-100 score and a short, specific note. "
            "(2) Then call complete_class with a one-sentence reason summarizing what the student accomplished. "
            "The server awards the lesson's XP automatically — do not state an XP number yourself. "
            "Call complete_class exactly ONCE, only after genuine practice (never at the very start). "
            "After completing, give a brief, warm closing sentence. "
        )
    if session_type == "playground":
        return (
            "At the natural end of the session, call record_skill_score once for each skill the student practiced, "
            "with a fair score and a short, specific note. "
        )
    return ""


async def _fetch_pending_words(client: httpx.AsyncClient, student_id: str, headers: dict) -> list[dict]:
    """Fetch word unlocks not yet used — best-effort, returns [] on any error."""
    try:
        resp = await client.get(f"/students/{student_id}/word-unlocks", headers=headers)
        if resp.status_code == 200:
            return [u for u in resp.json() if u.get("used_at") is None][:3]
    except Exception:
        pass
    return []


# ── Public API ────────────────────────────────────────────────────────────────

async def build_system_prompt(session_type: str, ref_id: str | None, token: str) -> str:
    """Build a NovaSonic system prompt with real student context.

    Args:
        session_type: 'class' | 'playground' | 'placement'
        ref_id: class_id or topic_id (None for placement)
        token: student's Cognito AccessToken

    Returns: Full system prompt string.
    """
    try:
        return await _build_with_context(session_type, ref_id, token)
    except Exception as exc:
        logger.warning("prompt_builder: context fetch failed (%s) — using fallback", exc)
        return _static_fallback(session_type)


async def _build_with_context(session_type: str, ref_id: str | None, token: str) -> str:
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(base_url=REST_BASE, timeout=3.0) as client:
        me_resp = await client.get("/auth/me", headers=headers)
        me_resp.raise_for_status()
        student: dict = me_resp.json()
        student_id = student["id"]

        # Parallel: memories + progress + last-1 summary
        memories_resp, progress_resp, history_resp = await asyncio.gather(
            client.get(f"/students/{student_id}/memories", headers=headers),
            client.get(f"/students/{student_id}/progress", headers=headers),
            client.get(f"/students/{student_id}/history?limit=1", headers=headers),
            return_exceptions=True,
        )

        memories: list[dict] = (
            memories_resp.json()
            if not isinstance(memories_resp, Exception) and memories_resp.status_code == 200
            else []
        )
        progress: dict = (
            progress_resp.json()
            if not isinstance(progress_resp, Exception) and progress_resp.status_code == 200
            else {}
        )
        summaries: list[dict] = (
            [s["summary_json"] for s in history_resp.json() if s.get("summary_json")]
            if not isinstance(history_resp, Exception) and history_resp.status_code == 200
            else []
        )

        # Parallel: module + class/topic
        band_min: float | None = None
        band_max: float | None = None
        module_info = class_info = topic_title = skill_type = ""

        module_task = (
            client.get(f"/modules/{student['current_module_id']}", headers=headers)
            if student.get("current_module_id") else None
        )
        class_task = (
            client.get(f"/classes/{ref_id}", headers=headers)
            if session_type == "class" and ref_id else None
        )
        topic_task = (
            client.get("/playground/topics", headers=headers)
            if session_type == "playground" and ref_id else None
        )

        tasks = [t for t in [module_task, class_task, topic_task] if t is not None]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        idx = 0
        if module_task is not None:
            r = results[idx]; idx += 1
            if not isinstance(r, Exception) and r.status_code == 200:
                mod = r.json()
                band_min, band_max = mod.get("band_min"), mod.get("band_max")
                module_info = (
                    f"The student is in the '{mod['title']}' module "
                    f"(IELTS band {mod['band_min']}–{mod['band_max']}). "
                )
        if class_task is not None:
            r = results[idx]; idx += 1
            if not isinstance(r, Exception) and r.status_code == 200:
                cls = r.json()
                skill_type = cls.get("skill_type", "")
                class_info = (
                    f"This is a {cls['skill_type']} class: '{cls['title']}'. "
                    f"{cls.get('description', '')} {cls.get('system_prompt_addendum', '')}"
                ).strip()
        if topic_task is not None:
            r = results[idx]
            if not isinstance(r, Exception) and r.status_code == 200:
                matched = next((t for t in r.json() if str(t["id"]) == str(ref_id)), None)
                if matched:
                    topic_title = matched["title"]

        # Fetch pending word unlocks (best-effort)
        pending_words = await _fetch_pending_words(client, student_id, headers)

    # ── Assemble ─────────────────────────────────────────────────────────────
    name = student.get("name") or "there"
    xp = student.get("xp_total", 0)

    prompt = (
        _PERSONA
        + f"You are speaking with {name}, who has earned {xp} XP so far. "
        + "Address them by name and make them feel welcomed and supported. "
        + module_info
    )

    weak_areas: list[str] = progress.get("weak_areas", [])
    if weak_areas:
        prompt += (
            f"Based on past sessions, {name} should focus on improving: "
            f"{', '.join(weak_areas)}. Weave gentle practice of these areas into the conversation "
            "without making it feel like a drill. "
        )

    if summaries:
        text = (str(summaries[0].get("summary", "")) if isinstance(summaries[0], dict) else str(summaries[0]))[:500]
        prompt += (
            f"For continuity, here is context from the last session: [Summary: {text}] "
            "Refer back to this naturally when relevant, but do not recite it. "
        )

    prompt += _memory_section(name, memories)
    prompt += _word_unlock_section(pending_words)
    prompt += _session_type_block(session_type, band_min, band_max, skill_type, class_info, topic_title)
    prompt += _tool_instructions(session_type)
    prompt += _OUTPUT_STYLE
    return prompt


def _static_fallback(session_type: str) -> str:
    if session_type == "placement":
        return _PERSONA + PLACEMENT_FALLBACK_INSTRUCTIONS + _OUTPUT_STYLE
    if session_type == "playground":
        return STATIC_FALLBACK + "This is a free conversation — let the student choose the topic and lead."
    return STATIC_FALLBACK + "This is a structured lesson — focus on teaching and guided practice."
