# CLAUDE.md — EnglishAI Platform

> Read this file in full before writing any code, creating any file, or making any architectural decision.
> This is the single source of truth for all development on this project.

---

## What This Project Is

An AI-native English learning platform. Every lesson is a live, spoken conversation between the student and **Amazon NovaSonic** (speech-to-speech via AWS Bedrock). No passive content — students always speak. The AI teaches, corrects, and promotes them automatically.

Full product spec: `docs/spec.md`
Task breakdown: `docs/tasks.md`

---

## Monorepo Layout

```
english-ai-platform/
├── CLAUDE.md
├── docs/
│   ├── spec.md          ← full product specification
│   └── tasks.md         ← ordered build tasks for Claude Code
├── docker-compose.yml   ← local: postgres + redis
├── .env.example
├── frontend/            ← React 18 + Vite + TypeScript  (port 5173)
├── backend/             ← FastAPI REST  (port 8000)
├── ws/                  ← FastAPI WebSocket  (port 8080)  ← SEPARATE process
└── infra/
    └── lambda/
        └── post_confirmation.py   ← Cognito trigger
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript + GSAP |
| Backend REST | Python 3.12 + FastAPI — port **8000** |
| Backend WS | Python 3.12 + FastAPI WebSocket — port **8080** (separate process) |
| AI | `amazon.nova-sonic-v1:0` via AWS Bedrock (`us-east-1`) |
| Auth | AWS Cognito — User Pool + Identity Pool |
| Database | PostgreSQL 16 + SQLAlchemy 2.x async + Alembic |
| Cache | Redis 7 |
| Queue | Celery (broker: Redis) |
| Storage | AWS S3 (optional audio archive) |

---

## Hard Rules — Never Violate These

### Architecture
- REST (`backend/`) and WebSocket (`ws/`) are **separate processes and separate directories**. Never merge them.
- WebSocket server handles all NovaSonic audio streaming. REST handles all data CRUD.
- The backend **never stores passwords**. Cognito owns all credentials.

### Authentication
- Frontend: use `amazon-cognito-identity-js` (or Amplify Auth)
- `AccessToken` stored **in memory only** — never `localStorage`
- `RefreshToken` in **HttpOnly cookie** only
- All REST requests: `Authorization: Bearer <AccessToken>`
- WebSocket handshake: `Authorization: Bearer <AccessToken>` header — never in URL
- Backend: validate tokens via Cognito JWKS cached at startup — never call JWKS per request

### Audio — exact specs, never deviate
| Direction | Format | Sample Rate | Channels |
|---|---|---|---|
| Client → Server | 16-bit PCM | 16,000 Hz | Mono |
| Server → Client | 16-bit PCM | 24,000 Hz | Mono |

- VAD RMS threshold: `0.012`
- Reject WebSocket connections that send wrong audio format

### Bedrock SDK
- Use `aws_sdk_bedrock_runtime` (Smithy-based) — **NOT** `boto3 bedrock-runtime`
- They have different streaming APIs — using boto3 will not work for bidirectional streaming

### Python conventions
- Python 3.12, type hints everywhere, no exceptions
- `async`/`await` throughout — zero blocking I/O on the event loop
- Pydantic v2 for all schemas
- SQLAlchemy 2.x async ORM (`async with AsyncSession`)
- All config via `pydantic-settings` reading from `.env` — never `os.environ` directly
- Services raise domain exceptions; routes catch and raise `HTTPException`
- Tests: `pytest` + `pytest-asyncio`

### TypeScript conventions
- `"strict": true` — no `any`, use `unknown` if needed
- Zustand for global state; React Query (`@tanstack/react-query`) for server state
- **GSAP** (`gsap` npm package) for all animations — page transitions, waveform, micro-interactions. Use `gsap.context()` for React cleanup. Do NOT use Framer Motion or CSS keyframe animations for any animated component.
- `services/api.ts` — only place that calls REST API
- `services/websocket.ts` — only place that manages WebSocket connections
- Audio processing in Web Workers where possible

---

## Backend Directory Structure

```
backend/                         # REST API — port 8000
├── pyproject.toml
├── requirements.txt
├── alembic.ini
├── Makefile
├── scripts/
│   └── seed.py                  # seed modules, classes, topics
├── tests/
│   ├── unit/
│   └── integration/
└── app/
    ├── main.py                  # FastAPI app factory
    ├── core/
    │   ├── config.py            # pydantic-settings — all env vars
    │   ├── cognito.py           # JWKS fetch (cached at startup) + token verify
    │   ├── dependencies.py      # get_current_student dependency
    │   ├── logging.py
    │   └── exceptions.py
    ├── db/
    │   ├── session.py           # async engine + session factory
    │   ├── base.py              # declarative base
    │   ├── models/
    │   │   ├── __init__.py      # imports all models (required for Alembic)
    │   │   ├── student.py
    │   │   ├── module.py        # Module, Class, Enrollment
    │   │   ├── session.py       # Session, SkillScore
    │   │   ├── level_audit.py   # LevelAuditLog
    │   │   └── playground_topic.py
    │   └── migrations/
    │       ├── env.py
    │       └── versions/
    ├── schemas/                 # Pydantic v2 models
    │   ├── auth.py
    │   ├── student.py
    │   ├── session.py
    │   └── module.py
    ├── api/
    │   └── v1/
    │       ├── router.py
    │       └── routes/
    │           ├── auth.py      # GET /auth/me, POST /auth/confirm-placement
    │           ├── students.py
    │           ├── sessions.py
    │           ├── modules.py
    │           └── playground.py
    ├── services/
    │   ├── student_service.py
    │   ├── session_service.py
    │   ├── level_up_service.py  # validation + audit log
    │   └── module_service.py
    └── tasks/
        ├── celery_app.py
        └── summarize.py         # post-session transcript summarization

ws/                              # WebSocket server — port 8080
├── main.py                      # FastAPI app factory
└── app/
    ├── routes/
    │   └── session_ws.py        # WS /ws/session endpoint
    └── services/
        ├── bedrock_stream.py    # BedrockStreamManager
        ├── prompt_builder.py    # builds NovaSonic system prompt
        └── level_up_service.py  # re-used from backend (symlink or shared package)
```

---

## Frontend Directory Structure

```
frontend/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
└── src/
    ├── main.tsx
    ├── App.tsx                  # router + auth guard
    ├── types/index.ts           # all shared TS types
    ├── services/
    │   ├── api.ts               # axios instance + interceptors
    │   └── websocket.ts         # NovaSonic WS session manager
    ├── store/
    │   ├── authStore.ts         # Cognito tokens, student profile (Zustand)
    │   └── sessionStore.ts      # active NovaSonic session state (Zustand)
    ├── hooks/
    │   ├── useAuth.ts           # Cognito helpers
    │   ├── useNovaSonic.ts      # audio capture + WS session lifecycle
    │   └── useVAD.ts            # voice activity detection (RMS 0.012)
    ├── components/
    │   ├── ui/                  # Button, Badge, Card, Modal, ProgressBar
    │   ├── layout/              # AppShell, Sidebar, TopBar
    │   └── session/
    │       ├── MicButton.tsx    # push-to-talk / VAD toggle
    │       ├── Transcript.tsx   # dual-column scrolling transcript
    │       ├── AIStatus.tsx     # Listening / Speaking / Thinking states
    │       ├── SessionBar.tsx   # topic name, elapsed time, XP earned
    │       └── SessionSummary.tsx
    ├── pages/
    │   ├── auth/LoginPage.tsx
    │   ├── PlacementSession.tsx
    │   ├── Dashboard.tsx
    │   ├── modules/
    │   │   ├── ModulePage.tsx
    │   │   └── ClassRoom.tsx
    │   ├── playground/
    │   │   ├── PlaygroundHome.tsx
    │   │   └── PlaygroundSession.tsx
    │   └── profile/ProfilePage.tsx
    └── utils/
        ├── audio.ts             # PCM encoding helpers
        └── format.ts            # date, XP, band display formatting
```

---

## Database Schema

```sql
-- students: keyed on Cognito sub, no password stored
students        (id, cognito_sub UNIQUE, name, email, current_module_id, placement_band, xp_total, placement_completed_at, created_at)

-- curriculum
modules         (id, band_min, band_max, title, description, xp_threshold, order_index)
classes         (id, module_id, title, skill_type, description, system_prompt_addendum, xp_reward, order_index)
enrollments     (student_id PK, module_id PK, xp_earned, started_at, completed_at)
playground_topics (id, slug UNIQUE, title, description, difficulty_band)

-- history & audit
sessions        (id, student_id, class_id?, topic_id?, session_type, started_at, ended_at, transcript_json, summary_json, xp_awarded)
skill_scores    (id, session_id, skill, score 0-100, notes, recorded_at)
level_audit_log (id, student_id, from_module_id, to_module_id, session_id, reason_text, evidence_json, created_at)
```

Enums:
- `skill_type` / `skill`: `speaking | listening | grammar | pronunciation`
- `session_type`: `class | playground | placement`

---

## API Reference

### REST — port 8000

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | public | |
| GET | `/auth/me` | ✓ | returns profile + `placement_required` flag |
| POST | `/auth/confirm-placement` | ✓ | sets module + placement_completed_at |
| GET | `/students/{id}` | ✓ | own record only |
| PUT | `/students/{id}` | ✓ | name update |
| GET | `/students/{id}/progress` | ✓ | XP, module, weak areas |
| GET | `/students/{id}/audit-log` | ✓ | level-up history |
| GET | `/students/{id}/history` | ✓ | recent sessions |
| GET | `/modules` | ✓ | all modules + student progress overlay |
| GET | `/modules/{id}` | ✓ | |
| GET | `/modules/{id}/classes` | ✓ | with completion status |
| GET | `/classes/{id}` | ✓ | |
| POST | `/sessions` | ✓ | create at session start |
| PATCH | `/sessions/{id}` | ✓ | update on end |
| POST | `/sessions/{id}/scores` | ✓ | append skill score |
| GET | `/sessions/{id}` | ✓ | |
| GET | `/playground/topics` | ✓ | |

### WebSocket — port 8080

```
WS /ws/session?type=class&ref_id={class_id}
WS /ws/session?type=playground&ref_id={topic_id}
WS /ws/session?type=placement
Header: Authorization: Bearer <AccessToken>
```

Binary frames = PCM audio. JSON frames = control events.

---

## NovaSonic Tools

Two tools registered at session start:

```python
record_skill_score(skill: str, score: int, notes: str)
# Call at session end for each practiced skill. skill ∈ [speaking, listening, grammar, pronunciation]

trigger_level_up(reason: str, evidence: dict)
# Call ONLY when confident student has mastered the module.
# evidence = { avg_scores: {...}, sessions_reviewed: N, key_improvements: [...] }
```

## NovaSonic System Prompt Variables

`prompt_builder.py` assembles from:
- `student.name`, `student.xp_total`
- `module.band_min`, `module.band_max`, `module.title`
- Last 3 `sessions.summary_json` — use condensed summary, **never** raw transcript JSON
- Aggregated weakness tags from recent `skill_scores`
- `class.description` + `class.system_prompt_addendum` (structured lessons)
- `topic.title` (playground sessions)

## Level-Up: Two-Stage Model

1. NovaSonic calls `trigger_level_up(reason, evidence)`
2. `level_up_service.py` validates:
   - ≥ `LEVELUP_MIN_SESSIONS` sessions in current module (default 5)
   - avg skill score ≥ `LEVELUP_MIN_AVG_SCORE` across last N sessions (default 70)
   - no level-up in last `LEVELUP_COOLDOWN_HOURS` hours (default 24) — check entire `level_audit_log`, not just current module
3. Approved → write `level_audit_log`, update `student.current_module_id`, notify frontend via WS event
4. Rejected → return reason to NovaSonic; it continues teaching

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql+asyncpg://englishai:password@localhost:5432/englishai

# Redis
REDIS_URL=redis://localhost:6379/0

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Cognito
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_APP_CLIENT_ID=
COGNITO_REGION=us-east-1

# Bedrock
BEDROCK_MODEL_ID=amazon.nova-sonic-v1:0

# S3
S3_BUCKET_NAME=

# App
ENVIRONMENT=development
REST_PORT=8000
WS_PORT=8080
LOG_LEVEL=INFO

# Level-up thresholds
LEVELUP_MIN_SESSIONS=5
LEVELUP_MIN_AVG_SCORE=70
LEVELUP_COOLDOWN_HOURS=24

# Playground XP cap (% of module xp_threshold earnable per day from playground)
PLAYGROUND_XP_DAILY_CAP_PCT=60
```

---

## Seed Data

### Modules (7 total)
| # | Band | Title | XP Threshold |
|---|---|---|---|
| 1 | 2.0–3.0 | Beginner Foundations | 500 |
| 2 | 3.0–4.0 | Elementary Communicator | 600 |
| 3 | 4.0–5.0 | Pre-Intermediate | 700 |
| 4 | 5.0–6.0 | Intermediate Fluency | 800 |
| 5 | 6.0–7.0 | Upper Intermediate | 900 |
| 6 | 7.0–8.0 | Advanced Expression | 1000 |
| 7 | 8.0–9.0 | Expert Precision | 1200 |

Each module has 4 classes: `speaking` (80 XP), `listening` (80 XP), `grammar` (70 XP), `pronunciation` (70 XP).

### Playground Topics (10 total)
`nature-environment`, `family-relationships`, `travel-places`, `technology-science`, `food-culture`, `current-events`, `health-wellbeing`, `sports-hobbies`, `work-career`, `animals-wildlife`

---

## Local Dev Commands

```bash
# Infrastructure
docker-compose up -d

# Backend REST
cd backend && uvicorn app.main:app --reload --port 8000

# WebSocket server
cd ws && uvicorn main:app --reload --port 8080

# Celery worker
cd backend && celery -A app.tasks.celery_app worker --loglevel=info

# Migrations
cd backend && alembic upgrade head

# Seed
cd backend && python scripts/seed.py

# Frontend
cd frontend && npm run dev
```

---

## Common Gotchas

- **Bedrock SDK**: `aws_sdk_bedrock_runtime` only. boto3 `bedrock-runtime` lacks bidirectional streaming.
- **JWKS caching**: fetch once at startup, cache globally. Never fetch per request.
- **WS token in header**: `Authorization: Bearer <token>` — tokens in URLs get logged by proxies/servers.
- **Audio validation**: reject client connections immediately if audio is not exactly 16-bit PCM 16kHz mono.
- **Playground XP cap**: enforce in `session_service.py` — check today's playground XP before awarding.
- **Level-up cooldown**: query all of `level_audit_log` for the student, not just the current module's entries.
- **Post-Confirmation Lambda**: must be deployed and wired to Cognito before any user registers. It creates the `students` row. Without it, `/auth/me` will return 404.
- **Raw transcript in prompt**: never inject `transcript_json` directly — always use `summary_json`. Raw transcripts are too long and unstructured.
- **Playground sessions and placement sessions**: `class_id` will be null for these. `topic_id` will be null for class and placement sessions. Both are nullable in the schema.

# Open Design to Vite Mapping Rules
- You have access to the Open Design MCP server.
- Extract styling tokens, UI slices, and layouts from the active Open Design workspace.
- Do not dump design artifacts as raw isolated HTML files.
- Translate Open Design layout frames directly into JSX/TSX React components.
- Save components directly into `./frontend/src/components/` so the active Vite hot-reloading dev server can pick them up.

# Development Workflow Rules
- You are building inside an active fullstack repository.
- Core Application Code: Frontend lives in `./frontend`, Backend lives in `./backend`.
- Do not create isolated layout sandboxes inside `.od/artifacts/` unless explicitly asked.
- Use Open Design MCP tools to discover brand guidelines, styles, or system tokens.
- Write all actual component updates, layouts, and system logic directly into the real `./frontend` and `./backend` file structures.
