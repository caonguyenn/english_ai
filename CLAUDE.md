# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A **Speech-to-Speech (S2S) Interactive AI Demo** using AWS Bedrock's Amazon Nova Sonic model. Enables real-time bidirectional audio streaming between a browser client and a Python async backend.

## Development Setup

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Required environment variables:**
```bash
export DEV_MODE=true              # Skips Cognito auth
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_DEFAULT_REGION=us-east-1
export LOGLEVEL=INFO              # Optional, default INFO
export PORT=80                    # WebSocket server port
```

## Running the Server

```bash
python backend/server.py
```

Then open `http://localhost:8080` in a browser. No frontend build step — `frontend/client.html` is a standalone file.

Health check: `curl http://localhost:8080/health`

## Architecture

**Backend** (`backend/server.py`) — single-file asyncio WebSocket server:
- `BedrockStreamManager` — manages bidirectional streaming session with AWS Bedrock, handles audio I/O events, and runs tool execution
- `WebSocketServer` — accepts WebSocket connections, dispatches audio frames and control messages to `BedrockStreamManager`
- HTTP health endpoint runs alongside the WebSocket server on port 8080

**Frontend** (`frontend/client.html`) — vanilla JS single-page app:
- Captures microphone via Web Audio API, applies Voice Activity Detection (RMS threshold 0.012), encodes to 16-bit PCM at 16 kHz, and sends over WebSocket
- Receives 24 kHz PCM audio + text transcripts from the server and plays them back

**Audio pipeline:**
- Client → Server: 16-bit PCM mono @ 16 kHz
- Server → Client: 16-bit PCM mono @ 24 kHz (Nova Sonic native output)

**AWS Bedrock integration:**
- Model: `amazon.nova-sonic-v1:0` in `us-east-1`
- Uses `aws_sdk_bedrock_runtime` (Smithy-based SDK), not boto3 bedrock-runtime
- Credentials can also be loaded from AWS Secrets Manager at startup

## Key Implementation Notes

- `BedrockStreamManager.tool_processor` is `None` — tool calls (`getDateAndTimeTool`, `trackOrderTool`) have handler stubs but the processor is not wired up
- Cognito auth is prepared but bypassed when `DEV_MODE=true`
- No automated test suite — testing is manual via the browser UI
- MCP server code is present but commented out
