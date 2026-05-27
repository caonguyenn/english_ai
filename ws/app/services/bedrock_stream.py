"""BedrockStreamManager — bidirectional NovaSonic streaming via aws_sdk_bedrock_runtime.

Event JSON builders live in bedrock_events.py.
Migrated from backend/server.py: removed websockets/aiohttp/Secrets Manager/old tools;
added tool_handler param, system_prompt param, is_active property.
"""
import asyncio
import base64
import json
import logging
import uuid
from typing import TYPE_CHECKING

from aws_sdk_bedrock_runtime.client import (
    BedrockRuntimeClient,
    InvokeModelWithBidirectionalStreamOperationInput,
)
from aws_sdk_bedrock_runtime.config import (
    Config,
    HTTPAuthSchemeResolver,
    SigV4AuthScheme,
)
from aws_sdk_bedrock_runtime.models import (
    BidirectionalInputPayloadPart,
    InvokeModelWithBidirectionalStreamInputChunk,
)
from smithy_aws_core.identity.environment import EnvironmentCredentialsResolver

from app.config import settings
import app.services.bedrock_events as ev

if TYPE_CHECKING:
    from app.services.tool_handler import ToolHandler

logger = logging.getLogger(__name__)


class BedrockStreamManager:
    """Manages bidirectional streaming with Amazon NovaSonic via Bedrock."""

    def __init__(self, tool_handler: "ToolHandler", model_id: str = "", region: str = "") -> None:
        self.tool_handler = tool_handler
        self.model_id = model_id or settings.BEDROCK_MODEL_ID
        self.region = region or settings.AWS_REGION

        self.audio_input_queue: asyncio.Queue = asyncio.Queue()
        self.output_queue: asyncio.Queue = asyncio.Queue()

        self._is_active = False
        self.barge_in = False
        self.role: str | None = None
        self.display_assistant_text = False

        self.prompt_name = str(uuid.uuid4())
        self.content_name = str(uuid.uuid4())
        self.audio_content_name = str(uuid.uuid4())

        self._tool_name = ""
        self._tool_use_id = ""
        self._tool_content: dict = {}
        self.pending_tool_tasks: dict[str, asyncio.Task] = {}

        self._client: BedrockRuntimeClient | None = None
        self._stream = None
        self._response_task: asyncio.Task | None = None
        self._audio_task: asyncio.Task | None = None

    @property
    def is_active(self) -> bool:
        return self._is_active

    # ------------------------------------------------------------------
    # Initialization
    # ------------------------------------------------------------------

    def _init_client(self) -> None:
        config = Config(
            endpoint_uri=f"https://bedrock-runtime.{self.region}.amazonaws.com",
            region=self.region,
            http_auth_scheme_resolver=HTTPAuthSchemeResolver(),
            http_auth_schemes={"aws.auth#sigv4": SigV4AuthScheme()},
            aws_credentials_identity_resolver=EnvironmentCredentialsResolver(),
        )
        self._client = BedrockRuntimeClient(config=config)

    async def initialize_stream(self, system_prompt: str) -> None:
        """Open bidirectional stream and send session + prompt init events."""
        if not self._client:
            self._init_client()

        self._stream = await self._client.invoke_model_with_bidirectional_stream(  # type: ignore[union-attr]
            InvokeModelWithBidirectionalStreamOperationInput(model_id=self.model_id)
        )
        self._is_active = True

        for event in (
            ev.SESSION_START,
            ev.prompt_start(self.prompt_name),
            ev.text_content_start(self.prompt_name, self.content_name, "SYSTEM"),
            ev.text_input(self.prompt_name, self.content_name, system_prompt),
            ev.content_end(self.prompt_name, self.content_name),
        ):
            await self._send(event)
            await asyncio.sleep(0.05)

        await self._send(ev.audio_content_start(self.prompt_name, self.audio_content_name))

        self._response_task = asyncio.create_task(self._process_responses())
        self._audio_task = asyncio.create_task(self._process_audio_input())
        await asyncio.sleep(0.1)
        logger.info("Bedrock stream initialized — model=%s", self.model_id)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def add_audio_chunk(self, audio_bytes: bytes) -> None:
        """Non-blocking enqueue of raw PCM audio bytes (16-bit, 16 kHz, mono)."""
        self.audio_input_queue.put_nowait(audio_bytes)

    async def _send(self, event_json: str) -> None:
        if not self._stream or not self._is_active:
            return
        chunk = InvokeModelWithBidirectionalStreamInputChunk(
            value=BidirectionalInputPayloadPart(bytes_=event_json.encode("utf-8"))
        )
        try:
            await self._stream.input_stream.send(chunk)
        except Exception as exc:
            logger.error("Error sending event to Bedrock: %s", exc)

    # ------------------------------------------------------------------
    # Background tasks
    # ------------------------------------------------------------------

    async def _process_audio_input(self) -> None:
        while self._is_active:
            try:
                audio_bytes = await self.audio_input_queue.get()
                b64 = base64.b64encode(audio_bytes).decode("utf-8")
                await self._send(ev.audio_input(self.prompt_name, self.audio_content_name, b64))
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("Audio input error: %s", exc)

    async def _process_responses(self) -> None:
        try:
            while self._is_active:
                try:
                    output = await self._stream.await_output()  # type: ignore[union-attr]
                    result = await output[1].receive()
                    if result.value and result.value.bytes_:
                        self._handle_bytes(result.value.bytes_)
                except StopAsyncIteration:
                    break
                except Exception as exc:
                    logger.error("Bedrock response error: %s", exc)
                    break
        finally:
            logger.info("Bedrock response stream ended")
            self._is_active = False

    def _handle_bytes(self, raw: bytes) -> None:
        try:
            data = json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.output_queue.put_nowait({"raw_data": raw.decode("utf-8", errors="replace")})
            return

        event = data.get("event", {})

        if "contentStart" in event:
            self.role = event["contentStart"].get("role")
            extra = event["contentStart"].get("additionalModelFields", "")
            if extra:
                try:
                    self.display_assistant_text = (
                        json.loads(extra).get("generationStage") == "SPECULATIVE"
                    )
                except json.JSONDecodeError:
                    pass
        elif "textOutput" in event:
            if '{ "interrupted" : true }' in event["textOutput"].get("content", ""):
                self.barge_in = True
        elif "toolUse" in event:
            self._tool_name = event["toolUse"].get("toolName", "")
            self._tool_use_id = event["toolUse"].get("toolUseId", "")
            self._tool_content = event["toolUse"]
        elif "contentEnd" in event and event["contentEnd"].get("type") == "TOOL":
            self._dispatch_tool(self._tool_name, self._tool_content, self._tool_use_id)

        self.output_queue.put_nowait(data)

    def _dispatch_tool(self, tool_name: str, tool_content: dict, tool_use_id: str) -> None:
        cname = str(uuid.uuid4())
        task = asyncio.create_task(self._execute_tool(tool_name, tool_content, tool_use_id, cname))
        self.pending_tool_tasks[cname] = task
        task.add_done_callback(lambda _t: self.pending_tool_tasks.pop(cname, None))

    async def _execute_tool(
        self, tool_name: str, tool_content: dict, tool_use_id: str, cname: str
    ) -> None:
        try:
            raw_input = tool_content.get("content", "{}")
            tool_input = json.loads(raw_input) if isinstance(raw_input, str) else raw_input
            result = await self.tool_handler.process_tool(tool_name, tool_input)
        except Exception as exc:
            logger.error("Tool %s execution failed: %s", tool_name, exc)
            result = {"error": f"Tool execution failed: {exc}"}
        try:
            await self._send(ev.tool_content_start(self.prompt_name, cname, tool_use_id))
            await self._send(ev.tool_result(self.prompt_name, cname, json.dumps(result)))
            await self._send(ev.content_end(self.prompt_name, cname))
        except Exception as exc:
            logger.error("Failed to send tool result: %s", exc)

    # ------------------------------------------------------------------
    # Shutdown
    # ------------------------------------------------------------------

    async def close(self) -> None:
        """Gracefully close Bedrock stream and cancel all pending tasks."""
        if not self._is_active:
            return

        for task in list(self.pending_tool_tasks.values()):
            task.cancel()
        for task in (self._response_task, self._audio_task):
            if task and not task.done():
                task.cancel()

        try:
            await self._send(ev.content_end(self.prompt_name, self.audio_content_name))
            await self._send(ev.prompt_end(self.prompt_name))
            await self._send(ev.SESSION_END)
        except Exception as exc:
            logger.warning("Error during stream close sequence: %s", exc)
        finally:
            self._is_active = False
            if self._stream:
                try:
                    await self._stream.input_stream.close()
                except Exception:
                    pass
