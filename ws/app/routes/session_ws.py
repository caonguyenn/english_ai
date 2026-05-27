"""WebSocket route: /ws/session

Query params:
  type  — class | playground | placement
  ref_id — required for class/playground, omitted for placement

Auth flow (first-message pattern — browser WS API cannot set custom headers):
  1. Accept connection
  2. Wait up to 5 s for {"type":"auth","token":"<AccessToken>","session_id":42}
  3. Validate JWT; close 1008 on failure
  4. Initialize Bedrock stream and spawn background tasks
"""
import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.auth import authenticate_websocket
from app.services.bedrock_stream import BedrockStreamManager
from app.services.prompt_builder import build_system_prompt
from app.services.tool_handler import ToolHandler

logger = logging.getLogger(__name__)
router = APIRouter()

_VALID_TYPES = {"class", "playground", "placement"}


# ---------------------------------------------------------------------------
# Background helper coroutines
# ---------------------------------------------------------------------------

async def _forward_responses(websocket: WebSocket, stream: BedrockStreamManager) -> None:
    """Dequeue Bedrock events and forward to the WebSocket client as JSON."""
    try:
        while stream.is_active:
            response = await stream.output_queue.get()
            await websocket.send_json(response)
    except Exception:
        pass


async def _keepalive(stream: BedrockStreamManager) -> None:
    """Send 100 ms silence every second to keep the Bedrock stream alive."""
    silence = b"\x00\x00" * 3200  # 100 ms @ 16 kHz 16-bit mono
    while stream.is_active:
        await asyncio.sleep(1)
        if stream.is_active:
            stream.add_audio_chunk(silence)


async def _watch_stream(websocket: WebSocket, stream: BedrockStreamManager) -> None:
    """Close the WebSocket when the Bedrock stream terminates."""
    while stream.is_active:
        await asyncio.sleep(1)
    try:
        await websocket.close()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Main endpoint
# ---------------------------------------------------------------------------

@router.websocket("/ws/session")
async def websocket_session(
    websocket: WebSocket,
    type: str = Query(..., description="Session type: class | playground | placement"),
    ref_id: int | None = Query(None, description="class_id or topic_id; omit for placement"),
) -> None:
    # -- Validate query params BEFORE accepting (cannot send 1008 before accept on most clients,
    #    but we still guard here to fail fast after accept)
    if type not in _VALID_TYPES:
        await websocket.accept()
        await websocket.close(code=1008, reason="Invalid session type")
        return
    if type != "placement" and ref_id is None:
        await websocket.accept()
        await websocket.close(code=1008, reason="ref_id required for class and playground sessions")
        return

    await websocket.accept()

    # -- First-message auth
    payload = await authenticate_websocket(websocket)
    if payload is None:
        return  # already closed with 1008

    student_sub: str = payload.get("sub", "")
    session_id: int = payload["_session_id"]
    # Preserve raw token so prompt_builder and tool_handler can call REST API
    # on behalf of the authenticated student.
    token: str = payload.get("_token", "")

    await websocket.send_json({"event": {"connectionStatus": {"status": "authenticated"}}})

    # -- Build session components
    system_prompt = await build_system_prompt(type, ref_id, token)

    async def _send_level_up_event(result: dict) -> None:
        """Forward approved level-up to the frontend as a WS JSON event."""
        try:
            await websocket.send_json({
                "event": {
                    "levelUp": {
                        "from_module": result.get("from_module", ""),
                        "to_module": result.get("to_module", ""),
                        "to_module_id": result.get("new_module_id", 0),
                        "band": result.get("new_band", 0),
                    }
                }
            })
        except Exception as exc:
            logger.warning("Failed to send level-up event to client: %s", exc)

    tool_handler = ToolHandler(
        student_sub=student_sub,
        session_id=session_id,
        session_type=type,
        ref_id=ref_id,
        token=token,
        on_level_up=_send_level_up_event,
    )
    stream = BedrockStreamManager(tool_handler=tool_handler)

    try:
        await stream.initialize_stream(system_prompt)
    except Exception as exc:
        logger.error("Failed to initialize Bedrock stream: %s", exc)
        await websocket.close(code=1011, reason="Stream initialization failed")
        return

    logger.info(
        "Session started — student=%s session_id=%s type=%s ref_id=%s",
        student_sub, session_id, type, ref_id,
    )

    forward_task = asyncio.create_task(_forward_responses(websocket, stream))
    keepalive_task = asyncio.create_task(_keepalive(stream))
    watch_task = asyncio.create_task(_watch_stream(websocket, stream))

    try:
        while True:
            message = await websocket.receive()
            if message.get("bytes"):
                stream.add_audio_chunk(message["bytes"])
            elif message.get("text"):
                if message["text"] == "close":
                    break
                # Ignore other text control frames for now (Phase 6 may add events)
    except WebSocketDisconnect:
        logger.info("Client disconnected — student=%s session_id=%s", student_sub, session_id)
    finally:
        forward_task.cancel()
        keepalive_task.cancel()
        watch_task.cancel()
        await stream.close()
        logger.info(
            "Session closed — student=%s session_id=%s scores=%s",
            student_sub, session_id, tool_handler.recorded_scores,
        )
