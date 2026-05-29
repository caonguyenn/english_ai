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

REST_BASE = f"{settings.REST_BASE_URL}/api/v1"

# ── Shared persona ────────────────────────────────────────────────────────────
# Defines who the AI is across every session type. Keep this voice consistent so
# the student experiences one continuous tutor, not a different bot per session.
_PERSONA = (
    "You are Professor Nova, a warm and highly experienced English tutor. "
    "You are patient, genuinely encouraging, and build real rapport with each student, "
    "while holding them to high standards. You sound like a thoughtful human teacher — "
    "never robotic, never reading from a script. "
)

# How mistakes are handled: recast the correct form naturally, then a one-line why,
# then keep the conversation moving. This corrects without interrupting fluency.
_CORRECTION_STYLE = (
    "When the student makes a grammar, vocabulary, or pronunciation mistake, "
    "naturally restate their sentence the correct way, give a brief one-sentence reason, "
    "then continue the conversation with a follow-up question. "
    "For example, if they say 'I go to store yesterday', respond: "
    "'Ah, you went to the store yesterday — we use \"went\" for the past. So, what did you buy?' "
    "Praise genuine progress specifically. Never overwhelm the student with multiple corrections at once; "
    "prioritize the one or two mistakes that matter most. "
)

# Spoken-output contract: NovaSonic speaks aloud, so written formatting must never appear.
_OUTPUT_STYLE = (
    "Keep every response concise and spoken-friendly: short, natural sentences, "
    "no bullet points, no markdown, no lists, no emojis. Speak as if talking face to face. "
)

_STATIC_FALLBACK = (
    _PERSONA
    + "Help the student improve their spoken English through natural conversation. "
    + _CORRECTION_STYLE
    + _OUTPUT_STYLE
)


def _band_guidance(band_min: float | None, band_max: float | None) -> str:
    """Return language-complexity guidance calibrated to the module's IELTS band.

    Lower bands → simpler vocabulary, slower pace, more scaffolding.
    Higher bands → richer vocabulary, idioms, abstract topics, faster pace.
    """
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
    """Return what the AI should emphasise for a given class skill type."""
    focus = {
        "speaking": "Prioritise fluency and confidence — keep the student talking as much as possible.",
        "listening": "Speak a little more and have the student respond to what they heard; check comprehension.",
        "grammar": "Gently focus corrections on sentence structure and verb forms relevant to this level.",
        "pronunciation": "Pay close attention to pronunciation; model tricky sounds and have the student repeat.",
        "vocabulary": "Introduce and reinforce useful new words and phrases, prompting the student to use them.",
    }
    return focus.get(skill_type, "")


async def build_system_prompt(
    session_type: str,
    ref_id: str | None,
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
    ref_id: str | None,
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
        band_min: float | None = None
        band_max: float | None = None
        skill_type = ""

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
                band_min = mod.get("band_min")
                band_max = mod.get("band_max")
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
                skill_type = cls.get("skill_type", "")
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
                    (t for t in topics_data if str(t["id"]) == str(ref_id)), None
                )
                if matched:
                    topic_title = matched["title"]

    # ── Assemble prompt ──────────────────────────────────────────────────────
    name = student.get("name") or "there"
    xp = student.get("xp_total", 0)

    # Persona + who the student is. Greet them by name to establish rapport.
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

    # Inject last 3 summaries — capped and bracketed to prevent prompt injection
    if summaries:
        prompt += "For continuity, here is context from recent sessions: "
        for i, summary in enumerate(summaries[:3], 1):
            if isinstance(summary, dict):
                text = str(summary.get("summary", ""))[:500]
            else:
                text = str(summary)[:500]
            prompt += f"[Session {i} summary: {text}] "
        prompt += "Refer back to this naturally when relevant, but do not recite it. "

    # Session-type specific instructions
    if session_type == "placement":
        prompt += (
            "Your task right now is to conduct a spoken English placement assessment. "
            "Open with a brief, friendly welcome, then begin. "
            "STEP 1 — Ask exactly 6 spoken questions, one at a time, waiting for the student's full spoken answer "
            "before moving on. Make each question feel like part of a natural conversation, not an interrogation. "
            "Question progression, from simple to demanding: (1) a simple self-introduction, (2) their daily routine, "
            "(3) describing a memorable past experience, (4) their opinion on a familiar everyday topic, "
            "(5) their view on a more abstract topic, (6) defending a position with reasons. "
            "STEP 2 — After the 6th answer, warmly say: 'Thank you, that completes your assessment.' "
            "STEP 3 — Call record_skill_score ONCE for speaking and ONCE for grammar with your honest evaluation. "
            "STEP 4 — Call trigger_level_up with reason='placement_complete' and evidence containing "
            "'placement_band' set to the student's assessed IELTS band (2.0-9.0). "
            "Example: evidence={\"placement_band\": 5.5, \"key_improvements\": [\"grammar\", \"fluency\"]}. "
            "CRITICAL RULES: "
            "- Do NOT call any tools until AFTER the 6th question is answered. "
            "- Do NOT correct mistakes or mention scores, levels, or bands during the assessment — just listen and assess. "
            "- Do NOT ask more than 6 questions. "
            "- Keep each question under two sentences and sound encouraging throughout. "
        )
    elif session_type == "playground":
        if topic_title:
            prompt += f"This is a relaxed, free-flowing conversation about: {topic_title}. "
        prompt += (
            "Let the student lead and take the conversation where they like. "
            "Your role is to keep it flowing with genuine curiosity, ask engaging follow-up questions, "
            "and help them express themselves more fully. "
            + _CORRECTION_STYLE
        )
    elif session_type == "class":
        prompt += (
            "This is a structured lesson, and YOU lead it. Open with a warm greeting and a clear, "
            "simple statement of what you'll practice together today, then guide the student through "
            "focused practice with engaging prompts and questions. Keep them actively speaking — "
            "do not lecture or monologue. "
            + _band_guidance(band_min, band_max)
            + _skill_focus(skill_type) + " "
            + class_info
            + " "
            + _CORRECTION_STYLE
            + "Aim for roughly 5–8 good exchanges that genuinely practice this skill. "
            "When the student has had solid, meaningful practice and you judge the lesson objective met, "
            "wrap up: briefly praise their specific progress, tell them they've completed the lesson, "
            "then (see tool instructions below) record their scores and complete the class. "
        )

    # Tool usage instructions
    if session_type == "class":
        prompt += (
            "TOOLS — at the end of the lesson, in this exact order: "
            "(1) Call record_skill_score once for each skill you meaningfully practiced "
            "(at minimum this class's skill), with a fair 0-100 score and a short, specific note. "
            "(2) Then call complete_class with a one-sentence reason summarizing what the student accomplished. "
            "The server awards the lesson's XP automatically — do not state an XP number yourself. "
            "Call complete_class exactly ONCE, only after genuine practice (never at the very start). "
            "After completing, give a brief, warm closing sentence. "
        )
    elif session_type == "playground":
        prompt += (
            "At the natural end of the session, call record_skill_score once for each skill the student practiced, "
            "with a fair score and a short, specific note. "
        )

    prompt += _OUTPUT_STYLE

    return prompt


def _static_fallback(session_type: str) -> str:
    """Return a static fallback prompt when REST API is unavailable."""
    if session_type == "placement":
        return (
            _PERSONA
            + "Your task right now is to conduct a spoken English placement assessment. "
            "Open with a brief, friendly welcome, then begin. "
            "STEP 1 — Ask exactly 6 questions, one at a time, waiting for each full answer, "
            "progressing from simple to demanding: (1) self-introduction, (2) daily routine, "
            "(3) a memorable past experience, (4) opinion on a familiar topic, "
            "(5) view on an abstract topic, (6) defending a position with reasons. "
            "STEP 2 — Warmly say: 'Thank you, that completes your assessment.' "
            "STEP 3 — Call record_skill_score for speaking and grammar. "
            "STEP 4 — Call trigger_level_up with reason='placement_complete' and evidence containing "
            "'placement_band' (2.0-9.0). "
            "CRITICAL: Do NOT call any tools until AFTER the 6th question is answered. "
            "Do NOT correct mistakes or mention scores during the assessment. Do NOT ask more than 6 questions. "
            + _OUTPUT_STYLE
        )
    if session_type == "playground":
        return _STATIC_FALLBACK + "This is a free conversation — let the student choose the topic and lead."
    return _STATIC_FALLBACK + "This is a structured lesson — focus on teaching and guided practice."
