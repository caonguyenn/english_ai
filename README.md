# English AI — Speech-to-Speech Voice Assistant

A real-time bidirectional speech-to-speech conversational AI using AWS Bedrock's Amazon Nova Sonic model. Users speak into their browser mic, receive AI responses as both text and synthesized audio, and engage in natural conversation with an English teacher AI assistant.

## Features

- 🎤 **Real-time Voice I/O** — WebSocket-based bidirectional audio streaming
- 🤖 **AI Voice Assistant** — Amazon Nova Sonic model via AWS Bedrock
- 📝 **Live Transcript** — See both user and AI responses in real-time
- 🎯 **English Teaching Mode** — AI corrects grammar, vocabulary, and pronunciation
- 🔊 **Voice Activity Detection (VAD)** — Automatic silence detection at 0.012 RMS threshold
- ⚡ **Low-Latency** — Stream-based architecture with no polling or batching

## Architecture

### Backend (`backend/server.py`)
- **BedrockStreamManager** — Manages bidirectional streaming session with AWS Bedrock
  - Handles audio I/O events, tool execution, response processing
  - Sends silent frames (keepalive) to prevent stream timeout
- **WebSocketServer** — Accepts connections, routes binary audio + JSON control messages
- **HTTP Health Endpoint** — `/health` for deployment checks

### Frontend (`frontend/src/`)
- **React + TypeScript** — Modern component-based UI
- **Web Audio API** — Microphone capture + playback
- **Voice Activity Detection** — RMS-based speech detection
- **Real-time Transcript** — Streaming message display with deduplication

### Audio Pipeline
- **Client → Server** — 16-bit PCM mono @ 16 kHz (binary WebSocket frames)
- **Server → Client** — 16-bit PCM mono @ 24 kHz (base64 in JSON events)

## Development Setup

### Prerequisites
- Python 3.12+
- Node.js 18+
- AWS Account with Bedrock access (us-east-1)

### Backend

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Set environment variables in `backend/.env`:
```bash
DEV_MODE=true                      # Skips Cognito auth
AWS_ACCESS_KEY_ID=<your_key>
AWS_SECRET_ACCESS_KEY=<your_secret>
AWS_DEFAULT_REGION=us-east-1
LOGLEVEL=INFO                      # Optional, default INFO
PORT=8000                          # WebSocket server port
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Set environment variables in `frontend/.env`:
```bash
VITE_WS_HOST=localhost
VITE_WS_PORT=8000
```

## Running the Application

**Start Backend:**
```bash
python backend/server.py
```

Server logs:
```
2026-04-02 03:46:35,870 Starting WebSocket server on 0.0.0.0:8000
2026-04-02 03:46:35,876 All services running - WebSocket: 8000
```

**Start Frontend:**
```bash
cd frontend
npm run dev
```

Then open `http://localhost:5173` in your browser.

**Health Check:**
```bash
curl http://localhost:8000/health
```

## How to Use

1. **Click the Mic Button** — Grant microphone permission
2. **Speak** — Voice Activity Detection triggers when you start talking
3. **Listen** — AI response plays automatically as synthesized audio
4. **See Transcript** — Both your input and AI response appear in real-time
5. **Continue** — Keep the conversation going or click to stop

The AI will:
- Correct your grammar and vocabulary
- Suggest more natural phrasings
- Ask follow-up questions
- Adapt language to your proficiency level

## Key Implementation Details

### WebSocket Protocol

**Binary Frames** (Client → Server):
- Raw 16-bit PCM audio from microphone
- Server automatically base64-encodes for Bedrock

**JSON Control Messages:**
- `sessionStart` — Begin session
- `promptStart` — Initialize prompt with audio output config
- `contentStart` — Open TEXT or AUDIO content block
- `textInput` / `audioInput` — Send content to Bedrock
- `contentEnd` / `promptEnd` / `sessionEnd` — Close blocks/session
- `stop` — VAD silence signal (ignored by server, doesn't disconnect)

### Deduplication & Speculative Content

Bedrock sends responses twice:
1. **SPECULATIVE** — Early guess (skipped by frontend)
2. **FINAL** — Complete response (displayed)

Frontend filters using `additionalModelFields` with `generationStage === 'SPECULATIVE'`.

### Keepalive Strategy

Backend sends 100ms silence frames every second to prevent Bedrock stream timeout:
```python
silence = b"\x00\x00" * 3200  # 100ms at 16kHz 16-bit
```

Without keepalive, idle conversations timeout after ~30 seconds.

## Troubleshooting

### "Timed out waiting for input events"
- **Cause**: No audio sent to Bedrock for >30 seconds
- **Fix**: Keepalive task should prevent this. Check if `is_active` state is correct.

### "Content name must be unique"
- **Cause**: Audio content block reopened with same UUID
- **Fix**: Open audio block once at session init, keep it open for entire session

### "Disconnected" immediately when speaking
- **Cause**: `stop` signal treated as disconnect
- **Fix**: `stop` now only closes audio turn (fixed in recent update)

### Missing AI responses in transcript
- **Cause**: `textOutput` events appended to wrong message
- **Fix**: Check `currentContentRoleRef` matches `textOutput.role` (fixed in recent update)

### Duplicate responses in transcript
- **Cause**: Both speculative and final content displayed
- **Fix**: Filter `additionalModelFields` for `generationStage === 'SPECULATIVE'` (fixed in recent update)

## Performance Notes

- **Latency**: ~500ms end-to-end (audio capture → Bedrock → response)
- **Memory**: ~100MB backend, ~50MB frontend
- **Concurrent Users**: Single instance handles 1 WebSocket connection; deploy multiple for scale
- **AWS Costs**: Charged per inference unit (roughly $0.003 per 60s conversation)

## Future Enhancements

- [ ] Tool execution (function calls from AI)
- [ ] User profiles with conversation history
- [ ] Adjustable proficiency levels
- [ ] Pronunciation scoring
- [ ] Barge-in detection (user interrupts AI)
- [ ] Multi-language support

## License

Amazon Software License (ASL). See LICENSE file.

## Contributing

See CLAUDE.md for development guidelines and architecture notes.
