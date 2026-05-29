"""NovaSonic tool execution — record_skill_score and trigger_level_up.

Persists data via REST API calls:
  - record_skill_score  → POST /sessions/{id}/scores  (student token)
  - trigger_level_up    → POST /sessions/{id}/level-up (X-Internal-Secret header)

Never raises — returns {"error": "..."} on failure so NovaSonic can continue.

Red Team Fix #14: Cognito access tokens expire in 1 hr. Sessions are expected
< 45 min (enforced by session timeout on WS server). Token refresh is deferred
to a future phase.
"""
import logging
from collections.abc import Awaitable, Callable

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

REST_BASE = f"{settings.REST_BASE_URL}/api/v1"

_VALID_SKILLS = frozenset({"speaking", "listening", "grammar", "pronunciation", "vocabulary"})

# Async callback type: called when a level-up is approved so the WS route can
# forward the event to the frontend without coupling bedrock_stream to the WS.
LevelUpCallback = Callable[[dict], Awaitable[None]]


class ToolHandler:
    """Handles tool calls dispatched by NovaSonic during a session."""

    def __init__(
        self,
        student_sub: str,
        session_id: str,
        session_type: str,
        ref_id: str | None,
        token: str,
        on_level_up: LevelUpCallback | None = None,
        on_complete: LevelUpCallback | None = None,
    ) -> None:
        self.student_sub = student_sub
        self.session_id = session_id
        self.session_type = session_type
        self.ref_id = ref_id
        self.token = token
        self.on_level_up = on_level_up
        self.on_complete = on_complete
        self.recorded_scores: list[dict] = []

    async def process_tool(self, tool_name: str, tool_input: dict) -> dict:
        """Dispatch a tool call from NovaSonic. Returns result dict, never raises."""
        if tool_name == "record_skill_score":
            return await self._record_skill_score(tool_input)
        if tool_name == "complete_class":
            return await self._complete_class(tool_input)
        if tool_name == "trigger_level_up":
            return await self._trigger_level_up(tool_input)
        logger.warning("Unknown tool called: %s", tool_name)
        return {"error": f"Unknown tool: {tool_name}"}

    async def _record_skill_score(self, input_data: dict) -> dict:
        """Persist skill score via REST POST /sessions/{id}/scores."""
        skill = input_data.get("skill")
        score = input_data.get("score")
        notes = input_data.get("notes", "")

        if skill not in _VALID_SKILLS:
            return {"error": f"Invalid skill: {skill}"}
        if not isinstance(score, int) or not (0 <= score <= 100):
            return {"error": f"Invalid score: {score}"}

        headers = {"Authorization": f"Bearer {self.token}"}
        try:
            async with httpx.AsyncClient(base_url=REST_BASE, timeout=5.0) as client:
                resp = await client.post(
                    f"/sessions/{self.session_id}/scores",
                    json={"skill": skill, "score": score, "notes": notes},
                    headers=headers,
                )
            if resp.status_code in (200, 201):
                self.recorded_scores.append(
                    {"skill": skill, "score": score, "notes": notes}
                )
                logger.info(
                    "Skill score recorded — session=%s skill=%s score=%s",
                    self.session_id, skill, score,
                )
                return {"status": "recorded", "skill": skill, "score": score}
            logger.error(
                "record_skill_score REST error: %s %s",
                resp.status_code, resp.text,
            )
            return {"error": f"REST error {resp.status_code}"}
        except Exception as exc:
            logger.error("record_skill_score failed: %s", exc)
            return {"error": str(exc)}

    async def _complete_class(self, input_data: dict) -> dict:
        """Mark a class session complete and award its XP via REST (internal secret).

        Only valid for class sessions; the server determines the XP amount from the
        class definition (the model does not choose XP).
        """
        if self.session_type == "mock_test":
            # Mock tests are scored post-session by the analysis engine — ignore this call.
            return {"result": "Mock test scoring is handled post-session."}
        if self.session_type != "class":
            return {"error": "complete_class is only valid for class sessions"}

        reason = input_data.get("reason", "")
        internal_headers = {"X-Internal-Secret": settings.INTERNAL_SECRET}
        try:
            async with httpx.AsyncClient(base_url=REST_BASE, timeout=5.0) as client:
                resp = await client.post(
                    f"/sessions/{self.session_id}/complete",
                    json={"reason": reason, "student_sub": self.student_sub},
                    headers=internal_headers,
                )
            if resp.status_code >= 500:
                logger.error("complete_class REST error %s: %s", resp.status_code, resp.text)
                return {"error": f"REST error {resp.status_code}"}
            result: dict = resp.json()
            logger.info(
                "complete_class — session=%s xp_awarded=%s",
                self.session_id, result.get("xp_awarded"),
            )
            if result.get("completed") and self.on_complete:
                try:
                    await self.on_complete(result)
                except Exception as cb_exc:
                    logger.error("on_complete callback failed: %s", cb_exc)
            return result
        except Exception as exc:
            logger.error("complete_class failed: %s", exc)
            return {"error": str(exc)}

    async def _trigger_level_up(self, input_data: dict) -> dict:
        """Validate level-up via REST POST /sessions/{id}/level-up (internal secret)."""
        reason = input_data.get("reason", "")
        evidence = input_data.get("evidence", {})

        internal_headers = {"X-Internal-Secret": settings.INTERNAL_SECRET}
        try:
            async with httpx.AsyncClient(base_url=REST_BASE, timeout=5.0) as client:
                resp = await client.post(
                    f"/sessions/{self.session_id}/level-up",
                    json={
                        "reason": reason,
                        "evidence": evidence,
                        "student_sub": self.student_sub,
                    },
                    headers=internal_headers,
                )
            if resp.status_code >= 500:
                logger.error("trigger_level_up REST error %s: %s", resp.status_code, resp.text)
                return {"error": f"REST error {resp.status_code}"}
            result: dict = resp.json()
            logger.info(
                "trigger_level_up — session=%s approved=%s reason=%s",
                self.session_id, result.get("approved"), result.get("reason"),
            )
            if result.get("approved") and self.on_level_up:
                try:
                    await self.on_level_up(result)
                except Exception as cb_exc:
                    logger.error("on_level_up callback failed: %s", cb_exc)
            return result
        except Exception as exc:
            logger.error("trigger_level_up failed: %s", exc)
            return {"error": str(exc)}
