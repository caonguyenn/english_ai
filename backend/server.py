#
# Copyright 2025 Amazon.com, Inc. and its affiliates. All Rights Reserved.
#
# Licensed under the Amazon Software License (the "License").
# You may not use this file except in compliance with the License.
# A copy of the License is located at
#
#   http://aws.amazon.com/asl/
#
# or in the "license" file accompanying this file. This file is distributed
# on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
# express or implied. See the License for the specific language governing
# permissions and limitations under the License.
#

import asyncio
import datetime
import inspect
import base64

# nova_s2s_backend.py
import json
import logging
import os
import time
import uuid
import warnings

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import boto3
import websockets
from aiohttp import web
from aws_sdk_bedrock_runtime.client import (
    BedrockRuntimeClient,  # Use BedrockRuntimeClient instead of BedrockRuntime
)
from aws_sdk_bedrock_runtime.client import (
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

# Configure logging
LOGLEVEL = os.environ.get("LOGLEVEL", "INFO").upper()
logging.basicConfig(level=LOGLEVEL, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)
RUNNING_IN_DEV_MODE = os.environ.get("DEV_MODE", "False").lower() == "true"
BEDROCK_SECRET_NAME = "bedrock_invoke_secret"
REGION = "us-east-1"

# Suppress warnings
warnings.filterwarnings("ignore")
# Suppress websockets server non-critical logs that are triggered by NLB health checks (empty TCP packets)
logging.getLogger("websockets.server").setLevel(logging.CRITICAL)

DEBUG = False


def debug_print(message):
    """Print only if debug mode is enabled"""
    if DEBUG:
        functionName = inspect.stack()[1].function
        if functionName == "time_it" or functionName == "time_it_async":
            functionName = inspect.stack()[2].function
        print(
            "{:%Y-%m-%d %H:%M:%S.%f}".format(datetime.datetime.now())[:-3]
            + " "
            + functionName
            + " "
            + message
        )


def time_it(label, methodToRun):
    start_time = time.perf_counter()
    result = methodToRun()
    end_time = time.perf_counter()
    debug_print(f"Execution time for {label}: {end_time - start_time:.4f} seconds")
    return result


async def time_it_async(label, methodToRun):
    start_time = time.perf_counter()
    result = await methodToRun()
    end_time = time.perf_counter()
    debug_print(f"Execution time for {label}: {end_time - start_time:.4f} seconds")
    return result


class BedrockStreamManager:
    """Manages bidirectional streaming with AWS Bedrock using asyncio"""

    # Event templates
    START_SESSION_EVENT = """{
        "event": {
            "sessionStart": {
            "inferenceConfiguration": {
                "maxTokens": 1024,
                "topP": 0.9,
                "temperature": 0.7
                }
            }
        }
    }"""

    CONTENT_START_EVENT = """{
        "event": {
            "contentStart": {
            "promptName": "%s",
            "contentName": "%s",
            "type": "AUDIO",
            "interactive": true,
            "role": "USER",
            "audioInputConfiguration": {
                "mediaType": "audio/lpcm",
                "sampleRateHertz": 16000,
                "sampleSizeBits": 16,
                "channelCount": 1,
                "audioType": "SPEECH",
                "encoding": "base64"
                }
            }
        }
    }"""

    AUDIO_EVENT_TEMPLATE = """{
        "event": {
            "audioInput": {
            "promptName": "%s",
            "contentName": "%s",
            "content": "%s"
            }
        }
    }"""

    TEXT_CONTENT_START_EVENT = """{
        "event": {
            "contentStart": {
            "promptName": "%s",
            "contentName": "%s",
            "type": "TEXT",
            "role": "%s",
            "interactive": false,
                "textInputConfiguration": {
                    "mediaType": "text/plain"
                }
            }
        }
    }"""

    TEXT_INPUT_EVENT = """{
        "event": {
            "textInput": {
            "promptName": "%s",
            "contentName": "%s",
            "content": "%s"
            }
        }
    }"""

    TOOL_CONTENT_START_EVENT = """{
        "event": {
            "contentStart": {
                "promptName": "%s",
                "contentName": "%s",
                "interactive": false,
                "type": "TOOL",
                "role": "TOOL",
                "toolResultInputConfiguration": {
                    "toolUseId": "%s",
                    "type": "TEXT",
                    "textInputConfiguration": {
                        "mediaType": "text/plain"
                    }
                }
            }
        }
    }"""

    CONTENT_END_EVENT = """{
        "event": {
            "contentEnd": {
            "promptName": "%s",
            "contentName": "%s"
            }
        }
    }"""

    PROMPT_END_EVENT = """{
        "event": {
            "promptEnd": {
            "promptName": "%s"
            }
        }
    }"""

    SESSION_END_EVENT = """{
        "event": {
            "sessionEnd": {}
        }
    }"""

    def start_prompt(self):
        """Create a promptStart event"""
        get_default_tool_schema = json.dumps(
            {"type": "object", "properties": {}, "required": []}
        )

        get_order_tracking_schema = json.dumps(
            {
                "type": "object",
                "properties": {
                    "orderId": {
                        "type": "string",
                        "description": "The order number or ID to track",
                    },
                    "requestNotifications": {
                        "type": "boolean",
                        "description": "Whether to set up notifications for this order",
                        "default": False,
                    },
                },
                "required": ["orderId"],
            }
        )

        prompt_start_event = {
            "event": {
                "promptStart": {
                    "promptName": self.prompt_name,
                    "textOutputConfiguration": {"mediaType": "text/plain"},
                    "audioOutputConfiguration": {
                        "mediaType": "audio/lpcm",
                        "sampleRateHertz": 24000,
                        "sampleSizeBits": 16,
                        "channelCount": 1,
                        "voiceId": "matthew",
                        "encoding": "base64",
                        "audioType": "SPEECH",
                    },
                    "toolUseOutputConfiguration": {"mediaType": "application/json"},
                    "toolConfiguration": {
                        "tools": [
                            {
                                "toolSpec": {
                                    "name": "getDateAndTimeTool",
                                    "description": "get information about the current date and time",
                                    "inputSchema": {"json": get_default_tool_schema},
                                }
                            },
                            {
                                "toolSpec": {
                                    "name": "trackOrderTool",
                                    "description": "Retrieves real-time order tracking information and detailed status updates for customer orders by order ID. Provides estimated delivery dates. Use this tool when customers ask about their order status or delivery timeline.",
                                    "inputSchema": {"json": get_order_tracking_schema},
                                }
                            },
                        ]
                    },
                }
            }
        }

        return json.dumps(prompt_start_event)

    def tool_result_event(self, content_name, content, role):
        """Create a tool result event"""

        if isinstance(content, dict):
            content_json_string = json.dumps(content)
        else:
            content_json_string = content

        tool_result_event = {
            "event": {
                "toolResult": {
                    "promptName": self.prompt_name,
                    "contentName": content_name,
                    "content": content_json_string,
                }
            }
        }
        return json.dumps(tool_result_event)

    def __init__(self, model_id="amazon.nova-sonic-v1:0", region="us-east-1"):
        """Initialize the stream manager."""
        self.model_id = model_id
        self.region = region

        # Replace RxPy subjects with asyncio queues
        self.audio_input_queue = asyncio.Queue()
        self.audio_output_queue = asyncio.Queue()
        self.output_queue = asyncio.Queue()

        self.response_task = None
        self.stream_response = None
        self.is_active = False
        self.barge_in = False
        self.bedrock_client = None

        # Audio playback components
        self.audio_player = None

        # Text response components
        self.display_assistant_text = False
        self.role = None

        # Session information
        self.prompt_name = str(uuid.uuid4())
        self.content_name = str(uuid.uuid4())
        self.audio_content_name = str(uuid.uuid4())
        self.toolUseContent = ""
        self.toolUseId = ""
        self.toolName = ""

        # Add a tool processor
        # self.tool_processor = ToolProcessor()
        self.tool_processor = None

        # Add tracking for in-progress tool calls
        self.pending_tool_tasks = {}

    def _initialize_client(self):
        """Initialize the Bedrock client."""
        config = Config(
            endpoint_uri=f"https://bedrock-runtime.{self.region}.amazonaws.com",
            region=self.region,
            aws_credentials_identity_resolver=EnvironmentCredentialsResolver(),
        )
        self.bedrock_client = BedrockRuntimeClient(config=config)

    async def initialize_stream(self):
        """Initialize the bidirectional stream with Bedrock."""
        if not self.bedrock_client:
            self._initialize_client()

        try:
            self.stream_response = await time_it_async(
                "invoke_model_with_bidirectional_stream",
                lambda: self.bedrock_client.invoke_model_with_bidirectional_stream(
                    InvokeModelWithBidirectionalStreamOperationInput(
                        model_id=self.model_id
                    )
                ),
            )
            self.is_active = True
            default_system_prompt = (
                "You are an expert English teacher and conversation coach. Your role is to help the user improve their spoken English through natural real-time conversation. "
                "After each response, gently correct any grammar, vocabulary, or pronunciation mistakes the user made, and suggest a more natural phrasing if needed. "
                "Encourage the user, keep them engaged, and adapt your language to their level — simpler and slower for beginners, more nuanced and challenging for advanced speakers. "
                "Ask follow-up questions to keep the conversation going and to practice specific language structures. "
                "Keep your responses concise and spoken-friendly: short sentences, no bullet points, no markdown. "
                "The user and you will engage in a spoken dialog exchanging the transcripts of a natural real-time conversation."
            )

            # Send initialization events
            prompt_event = self.start_prompt()
            text_content_start = self.TEXT_CONTENT_START_EVENT % (
                self.prompt_name,
                self.content_name,
                "SYSTEM",
            )
            text_content = self.TEXT_INPUT_EVENT % (
                self.prompt_name,
                self.content_name,
                default_system_prompt,
            )
            text_content_end = self.CONTENT_END_EVENT % (
                self.prompt_name,
                self.content_name,
            )

            init_events = [
                self.START_SESSION_EVENT,
                prompt_event,
                text_content_start,
                text_content,
                text_content_end,
            ]

            for event in init_events:
                await self.send_raw_event(event)
                # Small delay between init events
                await asyncio.sleep(0.1)

            # Open the audio content block (stays open for the entire session)
            await self.send_audio_content_start_event()

            # Start listening for responses
            self.response_task = asyncio.create_task(self._process_responses())

            # Start processing audio input
            asyncio.create_task(self._process_audio_input())

            # Wait a bit to ensure everything is set up
            await asyncio.sleep(0.1)

            debug_print("Stream initialized successfully")
            return self
        except Exception as e:
            self.is_active = False
            print(f"Failed to initialize stream: {str(e)}")
            raise

    async def send_raw_event(self, event_json):
        """Send a raw event JSON to the Bedrock stream."""
        if not self.stream_response or not self.is_active:
            debug_print("Stream not initialized or closed")
            return

        event = InvokeModelWithBidirectionalStreamInputChunk(
            value=BidirectionalInputPayloadPart(bytes_=event_json.encode("utf-8"))
        )

        try:
            await self.stream_response.input_stream.send(event)
            # For debugging large events, you might want to log just the type
            if DEBUG:
                if len(event_json) > 200:
                    event_type = json.loads(event_json).get("event", {}).keys()
                    debug_print(f"Sent event type: {list(event_type)}")
                else:
                    debug_print(f"Sent event: {event_json}")
        except Exception as e:
            debug_print(f"Error sending event: {str(e)}")
            if DEBUG:
                import traceback

                traceback.print_exc()

    async def send_audio_content_start_event(self):
        """Send a content start event to the Bedrock stream."""
        content_start_event = self.CONTENT_START_EVENT % (
            self.prompt_name,
            self.audio_content_name,
        )
        await self.send_raw_event(content_start_event)

    async def _process_audio_input(self):
        """Process audio input from the queue and send to Bedrock."""
        while self.is_active:
            try:
                # Get audio data from the queue
                data = await self.audio_input_queue.get()

                audio_bytes = data.get("audio_bytes")
                if not audio_bytes:
                    debug_print("No audio bytes received")
                    continue

                # Base64 encode the audio data
                blob = base64.b64encode(audio_bytes)
                audio_event = self.AUDIO_EVENT_TEMPLATE % (
                    self.prompt_name,
                    self.audio_content_name,
                    blob.decode("utf-8"),
                )

                # Send the event
                await self.send_raw_event(audio_event)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error processing audio: {e}", exc_info=True)

    def add_audio_chunk(self, audio_bytes):
        """Add an audio chunk to the queue."""
        self.audio_input_queue.put_nowait(
            {
                "audio_bytes": audio_bytes,
                "prompt_name": self.prompt_name,
                "content_name": self.audio_content_name,
            }
        )

    async def send_audio_content_end_event(self):
        """Send a content end event to the Bedrock stream."""
        if not self.is_active:
            debug_print("Stream is not active")
            return

        content_end_event = self.CONTENT_END_EVENT % (
            self.prompt_name,
            self.audio_content_name,
        )
        await self.send_raw_event(content_end_event)
        debug_print("Audio ended")

    async def send_tool_start_event(self, content_name, tool_use_id):
        """Send a tool content start event to the Bedrock stream."""
        content_start_event = self.TOOL_CONTENT_START_EVENT % (
            self.prompt_name,
            content_name,
            tool_use_id,
        )
        debug_print(f"Sending tool start event: {content_start_event}")
        await self.send_raw_event(content_start_event)

    async def send_tool_result_event(self, content_name, tool_result):
        """Send a tool content event to the Bedrock stream."""
        # Use the actual tool result from processToolUse
        tool_result_event = self.tool_result_event(
            content_name=content_name, content=tool_result, role="TOOL"
        )
        debug_print(f"Sending tool result event: {tool_result_event}")
        await self.send_raw_event(tool_result_event)

    async def send_tool_content_end_event(self, content_name):
        """Send a tool content end event to the Bedrock stream."""
        tool_content_end_event = self.CONTENT_END_EVENT % (
            self.prompt_name,
            content_name,
        )
        debug_print(f"Sending tool content event: {tool_content_end_event}")
        await self.send_raw_event(tool_content_end_event)

    async def send_prompt_end_event(self):
        """Close the stream and clean up resources."""
        if not self.is_active:
            debug_print("Stream is not active")
            return

        prompt_end_event = self.PROMPT_END_EVENT % (self.prompt_name)
        await self.send_raw_event(prompt_end_event)
        debug_print("Prompt ended")

    async def send_session_end_event(self):
        """Send a session end event to the Bedrock stream."""
        if not self.is_active:
            debug_print("Stream is not active")
            return

        await self.send_raw_event(self.SESSION_END_EVENT)
        self.is_active = False
        debug_print("Session ended")

    async def _process_responses(self):
        """Process incoming responses from Bedrock."""
        try:
            while self.is_active:
                try:
                    output = await self.stream_response.await_output()
                    result = await output[1].receive()
                    if result.value and result.value.bytes_:
                        try:
                            response_data = result.value.bytes_.decode("utf-8")
                            json_data = json.loads(response_data)

                            # Handle different response types
                            if "event" in json_data:
                                if "completionStart" in json_data["event"]:
                                    debug_print(
                                        f"completionStart: {json_data['event']}"
                                    )
                                elif "contentStart" in json_data["event"]:
                                    debug_print("Content start detected")
                                    content_start = json_data["event"]["contentStart"]
                                    # set role
                                    self.role = content_start["role"]
                                    # Check for speculative content
                                    if "additionalModelFields" in content_start:
                                        try:
                                            additional_fields = json.loads(
                                                content_start["additionalModelFields"]
                                            )
                                            if (
                                                additional_fields.get("generationStage")
                                                == "SPECULATIVE"
                                            ):
                                                debug_print(
                                                    "Speculative content detected"
                                                )
                                                self.display_assistant_text = True
                                            else:
                                                self.display_assistant_text = False
                                        except json.JSONDecodeError:
                                            debug_print(
                                                "Error parsing additionalModelFields"
                                            )
                                elif "textOutput" in json_data["event"]:
                                    text_content = json_data["event"]["textOutput"][
                                        "content"
                                    ]
                                    role = json_data["event"]["textOutput"]["role"]
                                    # Check if there is a barge-in
                                    if '{ "interrupted" : true }' in text_content:
                                        debug_print(
                                            "Barge-in detected. Stopping audio output."
                                        )
                                        self.barge_in = True

                                    if (
                                        self.role == "ASSISTANT"
                                        and self.display_assistant_text
                                    ):
                                        print(f"Assistant: {text_content}")
                                    elif self.role == "USER":
                                        print(f"User: {text_content}")
                                elif "audioOutput" in json_data["event"]:
                                    audio_content = json_data["event"]["audioOutput"][
                                        "content"
                                    ]
                                    audio_bytes = base64.b64decode(audio_content)
                                    await self.audio_output_queue.put(audio_bytes)
                                elif "toolUse" in json_data["event"]:
                                    self.toolUseContent = json_data["event"]["toolUse"]
                                    self.toolName = json_data["event"]["toolUse"][
                                        "toolName"
                                    ]
                                    self.toolUseId = json_data["event"]["toolUse"][
                                        "toolUseId"
                                    ]
                                    debug_print(
                                        f"Tool use detected: {self.toolName}, ID: {self.toolUseId}"
                                    )
                                elif (
                                    "contentEnd" in json_data["event"]
                                    and json_data["event"]
                                    .get("contentEnd", {})
                                    .get("type")
                                    == "TOOL"
                                ):
                                    debug_print(
                                        "Processing tool use and sending result"
                                    )
                                    # Start asynchronous tool processing - non-blocking
                                    self.handle_tool_request(
                                        self.toolName,
                                        self.toolUseContent,
                                        self.toolUseId,
                                    )
                                    debug_print("Processing tool use asynchronously")
                                elif "contentEnd" in json_data["event"]:
                                    debug_print("Content end")
                                elif "completionEnd" in json_data["event"]:
                                    # Handle end of conversation, no more response will be generated
                                    debug_print("End of response sequence")
                                elif "usageEvent" in json_data["event"]:
                                    debug_print(f"UsageEvent: {json_data['event']}")
                            # Put the response in the output queue for other components
                            await self.output_queue.put(json_data)
                        except json.JSONDecodeError:
                            await self.output_queue.put({"raw_data": response_data})
                except StopAsyncIteration:
                    # Stream has ended
                    break
                except Exception as e:
                    logger.error(f"Error receiving Bedrock response: {e}", exc_info=True)
                    break

        except Exception as e:
            logger.error(f"Response processing error: {e}", exc_info=True)
        finally:
            logger.info("Bedrock response stream ended, is_active -> False")
            self.is_active = False

    def handle_tool_request(self, tool_name, tool_content, tool_use_id):
        """Handle a tool request asynchronously"""
        # Create a unique content name for this tool response
        tool_content_name = str(uuid.uuid4())

        # Create an asynchronous task for the tool execution
        task = asyncio.create_task(
            self._execute_tool_and_send_result(
                tool_name, tool_content, tool_use_id, tool_content_name
            )
        )

        # Store the task
        self.pending_tool_tasks[tool_content_name] = task

        # Add error handling
        task.add_done_callback(
            lambda t: self._handle_tool_task_completion(t, tool_content_name)
        )

    def _handle_tool_task_completion(self, task, content_name):
        """Handle the completion of a tool task"""
        # Remove task from pending tasks
        if content_name in self.pending_tool_tasks:
            del self.pending_tool_tasks[content_name]

        # Handle any exceptions
        if task.done() and not task.cancelled():
            exception = task.exception()
            if exception:
                debug_print(f"Tool task failed: {str(exception)}")

    async def _execute_tool_and_send_result(
        self, tool_name, tool_content, tool_use_id, content_name
    ):
        """Execute a tool and send the result"""
        try:
            debug_print(f"Starting tool execution: {tool_name}")

            # Process the tool - this doesn't block the event loop
            tool_result = await self.tool_processor.process_tool_async(
                tool_name, tool_content
            )

            # Send the result sequence
            await self.send_tool_start_event(content_name, tool_use_id)
            await self.send_tool_result_event(content_name, tool_result)
            await self.send_tool_content_end_event(content_name)

            debug_print(f"Tool execution complete: {tool_name}")
        except Exception as e:
            debug_print(f"Error executing tool {tool_name}: {str(e)}")
            # Try to send an error response if possible
            try:
                error_result = {"error": f"Tool execution failed: {str(e)}"}

                await self.send_tool_start_event(content_name, tool_use_id)
                await self.send_tool_result_event(content_name, error_result)
                await self.send_tool_content_end_event(content_name)
            except Exception as send_error:
                debug_print(f"Failed to send error response: {str(send_error)}")

    async def close(self):
        """Close the stream properly."""
        if not self.is_active:
            return

        # Cancel any pending tool tasks
        for task in self.pending_tool_tasks.values():
            task.cancel()

        if self.response_task and not self.response_task.done():
            self.response_task.cancel()

        await self.send_audio_content_end_event()
        await self.send_prompt_end_event()
        await self.send_session_end_event()

        if self.stream_response:
            await self.stream_response.input_stream.close()


async def healthcheck(request):
    return web.Response(text="OK", status=200)


async def start_http_server(port):
    try:
        app = web.Application()
        app.router.add_get("/health", healthcheck)

        runner = web.AppRunner(app)
        await runner.setup()

        site = web.TCPSite(runner, "0.0.0.0", port)
        await site.start()

        print(f"Healthcheck running on port {port}")
    except Exception as e:
        print(f"Healthcheck FAILED: {e}")


async def websocket_handler(websocket, url, headers=None):
    """Handle WebSocket connections from the frontend with authentication."""
    # Validate the WebSocket connection using Cognito
    # is_valid, claims = (
    #     cognito.validate_websocket_request(url, headers)
    #     if not RUNNING_IN_DEV_MODE
    #     else True
    # ), {}

    # if not is_valid:
    #     # Log the failure with more detail
    #     logger.warning(f"Authentication failed for URL: {url}")

    #     # Send an authentication error and close the connection
    #     try:
    #         await websocket.send(
    #             json.dumps({"error": "Authentication failed", "status": "unauthorized"})
    #         )
    #     except:
    #         pass
    #     return

    # Log authenticated user
    user_id = uuid.uuid4()
    logger.info(f"Authenticated WebSocket connection for user: {user_id}")

    # Send authentication success message
    try:
        await websocket.send(
            json.dumps(
                {
                    "event": {
                        "connectionStatus": {
                            "status": "authenticated",
                            "message": "Connection authenticated successfully",
                        }
                    }
                }
            )
        )
    except:
        logger.error("Failed to send authentication success message")

    # Create a new stream manager for this connection
    stream_manager = BedrockStreamManager(
        model_id="amazon.nova-sonic-v1:0", region="us-east-1"
    )

    # Initialize the Bedrock stream
    await stream_manager.initialize_stream()

    # Start a task to forward responses from Bedrock to the WebSocket
    forward_task = asyncio.create_task(forward_responses(websocket, stream_manager))

    # Send silent audio frames to keep the Bedrock stream alive during inactivity
    async def keepalive():
        silence = b"\x00\x00" * 3200  # 100ms of silence at 16kHz 16-bit
        while stream_manager.is_active:
            await asyncio.sleep(1)
            if stream_manager.is_active:
                stream_manager.add_audio_chunk(silence)

    keepalive_task = asyncio.create_task(keepalive())

    # Close the WebSocket when the Bedrock stream dies
    async def watch_stream():
        while stream_manager.is_active:
            await asyncio.sleep(1)
        logger.info("Bedrock stream inactive, closing WebSocket")
        await websocket.close()

    watch_task = asyncio.create_task(watch_stream())

    try:
        async for message in websocket:
            try:
                if isinstance(message, bytes):
                    stream_manager.add_audio_chunk(message)
                    continue

                if message == "close":
                    break

                if message == "stop":
                    continue

                data = json.loads(message)

                if "event" in data:
                    event_type = list(data["event"].keys())[0]

                    # Store prompt name and content names if provided
                    if event_type == "promptStart":
                        stream_manager.prompt_name = data["event"]["promptStart"][
                            "promptName"
                        ]
                        await stream_manager.handle_prompt_start_with_tools(
                            data
                        )  # add the tool config
                        continue
                    elif (
                        event_type == "contentStart"
                        and data["event"]["contentStart"].get("type") == "AUDIO"
                    ):
                        stream_manager.audio_content_name = data["event"][
                            "contentStart"
                        ]["contentName"]

                    # Handle audio input separately
                    if event_type == "audioInput":
                        # Extract audio data
                        prompt_name = data["event"]["audioInput"]["promptName"]
                        content_name = data["event"]["audioInput"]["contentName"]
                        audio_base64 = data["event"]["audioInput"]["content"]

                        # Add to the audio queue
                        stream_manager.add_audio_chunk(
                            prompt_name, content_name, audio_base64
                        )
                    else:
                        # Send other events directly to Bedrock
                        await stream_manager.send_raw_event(data)
            except json.JSONDecodeError:
                logger.error("Invalid JSON received from WebSocket")
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {e}", exc_info=True)

    except websockets.exceptions.ConnectionClosed:
        logger.info("WebSocket connection closed")
    finally:
        forward_task.cancel()
        keepalive_task.cancel()
        watch_task.cancel()
        await stream_manager.close()


async def forward_responses(websocket, stream_manager):
    """Forward responses from Bedrock to the WebSocket."""
    try:
        while True:
            # Get next response from the output queue
            response = await stream_manager.output_queue.get()

            # Send to WebSocket
            try:
                await websocket.send(json.dumps(response))
            except websockets.exceptions.ConnectionClosed:
                break
    except asyncio.CancelledError:
        # Task was cancelled
        pass
    except Exception as e:
        logger.error(f"Error forwarding responses: {e}")


async def authenticated_handler(websocket, path=None):
    """Simplified handler that handles both path format and attributes"""
    # Debug info
    logger.info(f"New WebSocket connection with path: {path}")

    # Try to get path from various attributes
    if hasattr(websocket, "request") and hasattr(websocket.request, "path"):
        path = websocket.request.path
        logger.info(f"Using path from websocket.request.path: {path}")

    # Get headers
    headers = None
    if hasattr(websocket, "request_headers"):
        headers = websocket.request_headers
    elif hasattr(websocket, "request") and hasattr(websocket.request, "headers"):
        headers = websocket.request.headers

    # Validate token directly from path
    # First try to extract and validate the token directly
    # token = cognito.extract_token_from_url(path) if not RUNNING_IN_DEV_MODE else True
    token = True

    if token:
        # is_valid, _ = (
        #     cognito.validate_token(token) if not RUNNING_IN_DEV_MODE else True
        # ), None

        # if not is_valid:
        #     # Failed authentication
        #     logger.warning(f"Authentication failed for token from path: {path}")

        #     try:
        #         await websocket.send(
        #             json.dumps(
        #                 {"error": "Authentication failed", "status": "unauthorized"}
        #             )
        #         )
        #     except Exception as e:
        #         logger.error(f"Error sending auth failure message: {e}")
        #     return

        # Token is valid, proceed with websocket handler
        logger.info("Authenticated user")
        await websocket_handler(websocket, path, headers)
    else:
        # No token found
        logger.warning(f"No token found in path: {path}")

        try:
            await websocket.send(
                json.dumps(
                    {
                        "error": "Authentication failed - no token provided",
                        "status": "unauthorized",
                    }
                )
            )
        except Exception as e:
            logger.error(f"Error sending auth failure message: {e}")


async def main():
    """Main function to run the WebSocket server and MCP server."""
    # mcp_port = int(
    #     os.environ.get("MCP_PORT", 8000)
    # )  # communicate with MCP on port 80, localhost

    # Start MCP server and wait for it to be ready
    # logger.info(f"Starting MCP server on localhost:{mcp_port}")
    # mcp_task = asyncio.create_task(start_mcp_server(host="127.0.0.1", port=mcp_port))
    http_task = asyncio.create_task(start_http_server(8080))

    # Wait for MCP server to be ready
    await asyncio.sleep(2)

    # Verify MCP server is working
    # try:
    #     tools = await mcp_server.get_tools()
    #     tools_list = list(tools.values())  # Convert dict to list for len()
    #     logger.info(
    #         f"MCP server ready with {len(tools_list)} tools: {list(tools.keys())}"
    #     )
    # except Exception as e:
    #     logger.error(f"MCP server failed to start: {e}")
    #     mcp_task.cancel()
    #     raise

    # Now start WebSocket server
    port = int(os.environ.get("PORT", 80))
    host = "0.0.0.0"

    logger.info(f"Starting WebSocket server on {host}:{port}")

    try:
        async with websockets.serve(authenticated_handler, host, port):
            logger.info(f"All services running - WebSocket: {port}")
            await asyncio.Future()
    except Exception as e:
        logger.error(f"Server startup error: {e}", exc_info=True)
        raise
    finally:
        logger.info("Shutting down...")
        # mcp_task.cancel()
        http_task.cancel()
        # try:
        #     await mcp_task
        # except asyncio.CancelledError:
        #     pass


if __name__ == "__main__":
    # Set aws credential environment variables
    session = boto3.session.Session()
    client = session.client(service_name="secretsmanager", region_name=REGION)
    secret_value_response = client.get_secret_value(SecretId=BEDROCK_SECRET_NAME)
    secret = json.loads(secret_value_response["SecretString"])
    os.environ["AWS_ACCESS_KEY_ID"] = secret.get("AWS_ACCESS_KEY_ID")
    os.environ["AWS_SECRET_ACCESS_KEY"] = secret.get("AWS_SECRET_ACCESS_KEY")
    os.environ["AWS_DEFAULT_REGION"] = REGION
    # # Run the main function
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}", exc_info=True)
