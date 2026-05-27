# EnglishAI Platform — Application Specification

> AI-native English learning platform powered by Amazon NovaSonic (speech-to-speech). Every lesson is a live conversation — students speak, the AI listens, teaches, corrects, and promotes them automatically.

---

## Table of Contents

1. [Vision](#1-vision)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [User Journeys](#4-user-journeys)
5. [Frontend Specification](#5-frontend-specification)
6. [Backend Specification](#6-backend-specification)
7. [Database Schema](#7-database-schema)
8. [Audio Pipeline](#8-audio-pipeline)
9. [NovaSonic Integration](#9-novasonic-integration)
10. [Architecture Recommendations](#10-architecture-recommendations)

---

## 1. Vision

An AI-native English learning platform where every lesson is a live conversation with NovaSonic (Amazon Nova Sonic). Students speak; the AI listens, teaches, corrects, and — when ready — promotes them to the next level automatically. No passive video, no multiple-choice drills. Just talking.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Backend | Python 3.12 + FastAPI + asyncio WebSocket |
| AI Model | Amazon Nova Sonic (`amazon.nova-sonic-v1:0`) via AWS Bedrock |
| Database | PostgreSQL (async via SQLAlchemy + Alembic) |
| Cache | Redis (session state, rate limiting, connection registry) |
| Storage | S3-compatible object storage (optional audio archive) |
| Task Queue | Celery + worker (async jobs: summaries, XP recalc, notifications) |
| Region | AWS `us-east-1` |
| Auth | AWS Cognito (User Pool + Identity Pool, JWT via Cognito tokens) |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite)                     │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────┐  ┌────────┐  │
│  │ Login &     │  │ Module       │  │ Class    │  │Speaking│  │
│  │ Placement   │  │ Dashboard    │  │ Room     │  │Playground  │
│  └─────────────┘  └──────────────┘  └──────────┘  └────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ WebSocket (audio) / REST (data)
┌───────────────────────────▼─────────────────────────────────────┐
│                     Backend (FastAPI)                           │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ API Gateway │  │ Student      │  │ Session Orchestrator │   │
│  │(Cognito,CORS│  │ Service      │  │ (BedrockStreamMgr)   │   │
│  └─────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                 │
│  ┌───────────────────────────────┐  ┌──────────────────────┐   │
│  │ Learning History Service      │  │ Module & Class Svc   │   │
│  │ (sessions, scores, audit log) │  │ (curriculum seed)    │   │
│  └───────────────────────────────┘  └──────────────────────┘   │
└─────────────────┬───────────────────────────┬───────────────────┘
                  │                           │
    ┌─────────────▼──────────┐   ┌────────────▼────────────────┐
    │  PostgreSQL             │   │  AWS Bedrock                │
    │  - students             │   │  - NovaSonic v1:0           │
    │  - modules / classes    │   │  - System prompt injection  │
    │  - sessions             │   │  - Tool: record_skill_score │
    │  - skill_scores         │   │  - Tool: trigger_level_up   │
    │  - level_audit_log      │   └─────────────────────────────┘
    └─────────────────────────┘
```

---

## 4. User Journeys

### 4.1 Onboarding & Placement

When a student creates an account, they are immediately placed into a short (~10 minute) NovaSonic placement session. The AI conducts a structured spoken interview covering:

- Basic comprehension
- Vocabulary range
- Fluency and pronunciation
- Grammar in use

At the end, the backend scores the session across dimensions and assigns the student to an IELTS band range (e.g. 3–4). This determines their starting Module. The placement result is stored and contributes to the initial learning history context.

### 4.2 Module Learning Path

Each IELTS band maps to one Module. Inside each Module there are multiple Classes, each targeting a specific English skill:

| Skill Type | Description |
|---|---|
| Listening comprehension | NovaSonic reads a passage or scenario; student answers spoken questions |
| Speaking fluency | NovaSonic conducts a structured dialogue on a defined topic |
| Pronunciation | NovaSonic gives real-time phonetic feedback during practice drills |
| Grammar in context | Conversational grammar correction woven naturally into the dialogue |

Each class has an XP value. As students accumulate XP, the backend tracks progress toward a level-up threshold for the module.

### 4.3 Level-Up Flow

At the end of every NovaSonic session, the AI evaluates whether the student has demonstrated consistent mastery across the module's skill areas. When it determines they are ready, it signals the backend via a tool call (`trigger_level_up`). The backend then:

1. Validates the level-up signal and supporting evidence
2. Logs the event to `level_audit_log` (timestamp, session_id, scores, AI reasoning)
3. Updates the student's `current_module_id`
4. Returns the new module info to the frontend

The student sees a celebration screen and begins the next module.

### 4.4 Speaking Playground

A free-practice area with no structured curriculum. Students pick a topic card and simply talk with NovaSonic. The AI:

- Maintains engaging, natural conversation
- Gently corrects errors inline without breaking flow
- Introduces new vocabulary naturally in context

All playground sessions count toward module XP. This is the "fluency gym" — low pressure, high frequency practice.

**Available topic categories:**

- Nature & Environment
- Family & Relationships
- Travel & Places
- Technology & Science
- Food & Culture
- Current Events
- Health & Wellbeing
- Sports & Hobbies
- Work & Career
- Animals & Wildlife

---

## 5. Frontend Specification

**Stack:** React 18 + Vite + TypeScript. WebSocket client for NovaSonic sessions. REST for all other data.

### 5.1 Pages & Routes

| Route | Component | Description |
|---|---|---|
| `/login` | `LoginPage` | Cognito Hosted UI or embedded sign-in form. First-time users redirect to placement |
| `/placement` | `PlacementSession` | Full-screen NovaSonic placement interview UI |
| `/dashboard` | `Dashboard` | Module overview, XP progress, recent activity feed |
| `/modules/:id` | `ModulePage` | Class list, skill breakdown, completion status |
| `/class/:id` | `ClassRoom` | Live NovaSonic structured lesson UI |
| `/playground` | `PlaygroundHome` | Topic card grid |
| `/playground/:topic` | `PlaygroundSession` | Live NovaSonic free-talk session |
| `/profile` | `ProfilePage` | Student info, level history, session statistics |

### 5.2 NovaSonic Session UI (ClassRoom & PlaygroundSession)

This is the core interface, shared between structured classes and the playground.

**Components:**

- **Microphone button** — push-to-talk or VAD (Voice Activity Detection) mode. RMS threshold: `0.012`. Visual waveform animation while speaking.
- **Transcript pane** — scrolling dual-column view: student utterances (right, accent color) and AI tutor (left, neutral). Each turn timestamped.
- **Session context bar** — current class/topic name, elapsed time, XP earned this session.
- **AI status indicator** — distinct animated states: *Listening*, *Speaking*, *Thinking*.
- **End session button** — triggers summary screen with session stats, vocabulary introduced, and areas for improvement.

**Audio pipeline (client side):**
- Capture microphone via Web Audio API
- Apply VAD (RMS threshold `0.012`)
- Encode to 16-bit PCM mono at 16 kHz
- Send over WebSocket
- Receive 24 kHz PCM audio from server → play back via AudioContext

### 5.3 Placement Session UI

Identical to ClassRoom with the following differences:

- Progress indicator shown: "Question 3 of 8"
- No XP display during session
- End screen shows assigned IELTS band with brief explanation and module recommendation

### 5.4 Dashboard

- Module card showing current band, XP bar, and next milestone
- Recent activity list (last 5 sessions with date, type, XP earned)
- Shortcut buttons: "Continue Learning" → last class, "Go to Playground"
- Upcoming classes preview

### 5.5 Module Page

- Class cards listed in order with skill type badge, XP value, and completion status
- Overall module progress bar and estimated sessions to level-up
- Student's known weak areas highlighted based on session history

---

## 6. Backend Specification

### 6.1 API Gateway

- Cognito JWT verification on all protected routes (validates `id_token` / `access_token` issued by the User Pool)
- Rate limiting (standard REST: 100 req/min; WebSocket sessions: 1 concurrent per student)
- CORS configuration
- Health check endpoint: `GET /health` → `{ status: "ok", version: "..." }`

### 6.2 Auth Service (AWS Cognito)

Authentication is fully delegated to **AWS Cognito**. The backend does not issue or store passwords — Cognito owns the credential lifecycle.

**Cognito setup:**

| Resource | Configuration |
|---|---|
| User Pool | Email + password sign-up. MFA optional. Custom attributes: `custom:placement_completed` (boolean) |
| App Client | SRP auth flow. Token validity: ID/Access 1 hr, Refresh 30 days |
| Identity Pool | Grants temporary AWS credentials for direct S3 access (optional audio upload) |
| Triggers | Post-confirmation Lambda: creates `students` row in PostgreSQL, sets `placement_completed = false` |

**Frontend auth flow (using `amazon-cognito-identity-js` or AWS Amplify Auth):**

1. User signs up / signs in via Cognito Hosted UI or embedded form
2. On success, Cognito returns `IdToken`, `AccessToken`, `RefreshToken`
3. Frontend stores tokens in memory (not localStorage); `RefreshToken` in an HttpOnly cookie
4. All API requests send `Authorization: Bearer <AccessToken>`
5. Amplify Auth handles silent token refresh automatically

**Backend token validation:**

```python
import boto3
from jose import jwk, jwt

# Fetch Cognito JWKS once at startup
JWKS_URL = f"https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}/.well-known/jwks.json"

def verify_cognito_token(token: str) -> dict:
    # Decode header → get kid → match against JWKS → verify signature + expiry
    ...
```

**Backend endpoints (thin wrappers — Cognito does the heavy lifting):**

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/confirm-placement` | Called after placement session; sets `custom:placement_completed = true` in Cognito and DB |
| `GET` | `/auth/me` | Returns full student profile for the authenticated Cognito user (`sub` claim → student lookup) |

On first sign-up the Post-Confirmation Lambda fires automatically: inserts a `students` row keyed on the Cognito `sub` (UUID) and returns `placement_required: true` in the `/auth/me` response so the frontend redirects to the placement session.

### 6.3 Student Service

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/students/{id}` | Full student profile |
| `PUT` | `/students/{id}` | Update profile info |
| `GET` | `/students/{id}/progress` | XP, current module, completion %, weak areas |
| `POST` | `/students/{id}/level-up` | Validate and execute level-up (called by Session Orchestrator) |
| `GET` | `/students/{id}/audit-log` | Full level-up history |

**Level-up validation logic:**

When `trigger_level_up` tool is called by NovaSonic, the backend checks:
1. Minimum sessions completed in current module (configurable, e.g. 5)
2. Average `skill_score` across last N sessions is above threshold (configurable, e.g. 70/100)
3. No level-up event in the last 24 hours (prevent rapid oscillation)

If all pass: write to `level_audit_log`, update `current_module_id`, return success. If not: return rejection reason — NovaSonic can continue teaching without promotion.

### 6.4 Session Orchestrator (WebSocket, port 8080)

This is the core real-time service. Mirrors the reference `BedrockStreamManager` architecture with the following extensions:

**On connection:**
1. Validate JWT from WebSocket handshake headers
2. Fetch student profile + last 3 session summaries from DB
3. Build dynamic system prompt (see Section 9)
4. Open bidirectional Bedrock stream with `amazon.nova-sonic-v1:0`
5. Register tools: `record_skill_score`, `trigger_level_up`

**During session:**
- Forward audio frames (16-bit PCM, 16 kHz) from client → Bedrock
- Forward audio frames (24-bit PCM, 24 kHz) from Bedrock → client
- Forward text transcript events to client for display
- Execute tool calls as they arrive from NovaSonic

**On session end:**
1. Persist full transcript JSON to `sessions` table
2. Run async summarization job (Celery): condense transcript → `{strength, weakness, vocabulary_introduced}`
3. Return session summary to client

**Tools exposed to NovaSonic:**

```python
record_skill_score(skill: str, score: int, notes: str)
# skill ∈ ["speaking", "listening", "grammar", "pronunciation"]
# score: 0–100
# notes: brief AI reasoning for the score

trigger_level_up(reason: str, evidence: dict)
# reason: human-readable explanation
# evidence: {"avg_scores": {...}, "sessions_reviewed": N, "key_improvements": [...]}
```

### 6.5 Learning History Service

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| `POST` | `/sessions` | Create session record at start |
| `PATCH` | `/sessions/{id}` | Update with end time, transcript, XP |
| `POST` | `/sessions/{id}/scores` | Append skill scores |
| `GET` | `/students/{id}/history` | Recent sessions (default: last 10) |
| `GET` | `/sessions/{id}` | Full session detail with scores |

### 6.6 Module & Class Service

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/modules` | All modules with student's progress overlay |
| `GET` | `/modules/:id` | Module detail |
| `GET` | `/modules/:id/classes` | Class list with completion status |
| `GET` | `/classes/:id` | Class detail (description, skill type, XP reward) |
| `GET` | `/playground/topics` | All topic cards |

Modules are seeded at migration time. One module per IELTS band range:

| Module | Band Range | Title |
|---|---|---|
| 1 | 2.0 – 3.0 | Beginner Foundations |
| 2 | 3.0 – 4.0 | Elementary Communicator |
| 3 | 4.0 – 5.0 | Pre-Intermediate |
| 4 | 5.0 – 6.0 | Intermediate Fluency |
| 5 | 6.0 – 7.0 | Upper Intermediate |
| 6 | 7.0 – 8.0 | Advanced Expression |
| 7 | 8.0 – 9.0 | Expert Precision |

---

## 7. Database Schema

### Core Tables

```sql
-- Students
CREATE TABLE students (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cognito_sub     VARCHAR(255) UNIQUE NOT NULL,  -- Cognito User Pool 'sub' claim (immutable)
  name            VARCHAR(255) NOT NULL,
  email           VARCHAR(255) UNIQUE NOT NULL,
  current_module_id UUID REFERENCES modules(id),
  placement_band  DECIMAL(3,1),
  xp_total        INTEGER DEFAULT 0,
  placement_completed_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Modules
CREATE TABLE modules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_min        DECIMAL(3,1) NOT NULL,
  band_max        DECIMAL(3,1) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  xp_threshold    INTEGER NOT NULL,  -- XP required to level up
  order_index     INTEGER NOT NULL
);

-- Classes
CREATE TABLE classes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id       UUID NOT NULL REFERENCES modules(id),
  title           VARCHAR(255) NOT NULL,
  skill_type      VARCHAR(50) NOT NULL,  -- speaking | listening | grammar | pronunciation
  description     TEXT,
  system_prompt_addendum TEXT,           -- Class-specific NovaSonic instructions
  xp_reward       INTEGER NOT NULL,
  order_index     INTEGER NOT NULL
);

-- Playground Topics
CREATE TABLE playground_topics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            VARCHAR(100) UNIQUE NOT NULL,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  difficulty_band DECIMAL(3,1)  -- suggested min band; null = all levels
);

-- Enrollments
CREATE TABLE enrollments (
  student_id      UUID NOT NULL REFERENCES students(id),
  module_id       UUID NOT NULL REFERENCES modules(id),
  started_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  xp_earned       INTEGER DEFAULT 0,
  PRIMARY KEY (student_id, module_id)
);
```

### History & Audit Tables

```sql
-- Sessions
CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id),
  class_id        UUID REFERENCES classes(id),         -- null for playground/placement
  topic_id        UUID REFERENCES playground_topics(id),
  session_type    VARCHAR(20) NOT NULL,                -- class | playground | placement
  started_at      TIMESTAMPTZ DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  transcript_json JSONB,
  summary_json    JSONB,                               -- AI-generated post-session summary
  xp_awarded      INTEGER DEFAULT 0
);

-- Skill Scores (per session)
CREATE TABLE skill_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES sessions(id),
  skill           VARCHAR(50) NOT NULL,               -- speaking | listening | grammar | pronunciation
  score           INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  notes           TEXT,
  recorded_at     TIMESTAMPTZ DEFAULT now()
);

-- Level-Up Audit Log
CREATE TABLE level_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id),
  from_module_id  UUID REFERENCES modules(id),
  to_module_id    UUID NOT NULL REFERENCES modules(id),
  session_id      UUID NOT NULL REFERENCES sessions(id),
  reason_text     TEXT NOT NULL,
  evidence_json   JSONB NOT NULL,                     -- avg_scores, sessions_reviewed, key_improvements
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## 8. Audio Pipeline

```
Client                          Server                    AWS Bedrock
  │                               │                           │
  │  Mic capture (Web Audio API)  │                           │
  │  VAD → RMS threshold 0.012    │                           │
  │  Encode: 16-bit PCM, 16kHz   │                           │
  │──────── WebSocket ───────────▶│                           │
  │                               │  Bidirectional stream     │
  │                               │──────── Bedrock SDK ─────▶│
  │                               │                           │  NovaSonic processes
  │                               │◀────── 24kHz PCM ─────────│
  │◀──── WebSocket (audio) ───────│                           │
  │◀──── WebSocket (transcript) ──│                           │
  │  Play via AudioContext        │                           │
```

**Key parameters:**

| Direction | Encoding | Sample Rate | Channels |
|---|---|---|---|
| Client → Server | 16-bit PCM | 16,000 Hz | Mono |
| Server → Client (audio) | 16-bit PCM | 24,000 Hz | Mono |
| Server → Client (text) | JSON over WS | — | — |

**Bedrock SDK note:** Uses `aws_sdk_bedrock_runtime` (Smithy-based SDK), **not** `boto3 bedrock-runtime`. Credentials loaded from environment or AWS Secrets Manager at startup.

---

## 9. NovaSonic Integration

### 9.1 System Prompt Strategy

Each session receives a dynamically built system prompt injected at connection time. This is the primary mechanism by which NovaSonic behaves as a tutor who _remembers_ the student.

**Prompt template:**

```
You are Nova, an expert and encouraging English tutor on an IELTS preparation platform.

STUDENT PROFILE:
- Name: {student.name}
- Current IELTS band: {module.band_min}–{module.band_max}
- Learning goal: {student.goal}
- Total sessions completed: {student.session_count}

RECENT PERFORMANCE (last 3 sessions):
{formatted_session_summaries}

KNOWN WEAK AREAS:
{weakness_tags}

THIS SESSION:
- Type: {session_type}
- Focus: {class.description or topic.title}
- Specific instructions: {class.system_prompt_addendum}

TOOLS AVAILABLE:
- record_skill_score(skill, score, notes): call this at the end of the session to log
  the student's performance in each skill area.
- trigger_level_up(reason, evidence): call this ONLY when you are confident the student
  has mastered this module and is ready to advance.

TEACHING PRINCIPLES:
- Speak naturally. Corrections should feel like conversation, not classroom drills.
- Keep corrections brief — remodel the correct form and move on.
- Introduce 2–3 new vocabulary items naturally in context per session.
- Encourage the student frequently. Build confidence.
- Vary your questioning style to test different aspects of the target skill.
```

### 9.2 Post-Session Summary Generation

After each session ends, a Celery worker runs a summarization call to condense the transcript:

```json
{
  "strengths": ["Good use of past perfect", "Natural turn-taking"],
  "weaknesses": ["Third conditional errors", "Hesitation with collocations"],
  "vocabulary_introduced": ["subsequently", "in contrast", "as a matter of fact"],
  "recommended_focus_next": "Conditional structures"
}
```

This summary is stored in `sessions.summary_json` and injected into the system prompt of future sessions as "recent performance."

### 9.3 Level-Up Decision Model

Two-stage: AI recommends, backend decides.

1. NovaSonic calls `trigger_level_up(reason, evidence)` when it judges the student ready
2. Backend validates against hard eligibility rules (min sessions, min avg score, cooldown)
3. If eligible: execute promotion and audit log entry
4. If not eligible: return reason to NovaSonic, which can acknowledge and continue teaching

This keeps the AI in the pedagogical driver's seat while the backend enforces auditability.

---

## 10. Architecture Recommendations

### Separate WebSocket Process

Run the Session Orchestrator (WebSocket + NovaSonic stream) as a separate process or container from the REST API. NovaSonic sessions are long-lived, CPU-intensive, and I/O-bound. Separating them allows independent horizontal scaling — REST services can scale to 1 instance while WebSocket servers scale to N based on concurrent session load.

### Context Injection Quality

The biggest differentiator of this platform vs. a generic chatbot is the quality of NovaSonic's contextual awareness. Invest early in:

- **Structured session summaries** — run a cheap summarization call at session end (not inline, via Celery) to produce consistently formatted summaries that inject well into the system prompt
- **Weakness tag taxonomy** — define a fixed set of weakness tags (e.g. `third_conditional`, `article_usage`, `collocations`) so they accumulate meaningfully across sessions rather than being free-form text

### XP Balance — Playground vs Curriculum

To prevent students from grinding playground sessions to bypass curriculum classes, consider a daily XP cap from playground (e.g. maximum 60% of module XP threshold per day from free-talk). This keeps structured classes meaningful while still rewarding high-frequency practice.

### Admin Dashboard

A lightweight internal React page to:

- Monitor student progression and session volume in real time
- Review level-up audit log entries
- Manually override module assignments (with reason logging)
- Flag students for human review if skill scores are inconsistent with level-up recommendation

---

---

## Implementation Status

**Status:** ✓ Complete (May 27, 2026)

The full EnglishAI platform has been successfully implemented across 7 phases:

1. **DB + Backend Foundation** — Docker Compose (Postgres + Redis), all database models, Alembic migrations, seed data (7 modules, 28 classes, 10 topics), Cognito JWKS validation with dev mode bypass
2. **REST API + Admin Routes** — 27 REST endpoints (auth, students, sessions, modules, playground, admin), Pydantic v2 schemas, service layer, level-up validation with cooldown and min-session checks, admin routes with Cognito groups auth
3. **WebSocket Server** — Separate FastAPI process (port 8080), BedrockStreamManager for NovaSonic bidirectional streaming, first-message auth pattern, tools (record_skill_score, trigger_level_up), audio format validation (16-bit PCM 16kHz client → 24kHz server)
4. **Frontend Auth + Store** — Cognito auth flow with AccessToken in memory + RefreshToken in HttpOnly cookie, Zustand stores (authStore, sessionStore), axios API service with 401 retry queue, React Router with protected/admin route guards
5. **Frontend Student Pages** — 8 student pages (Dashboard, Modules, ClassRoom, Playground, Placement, Profile + session pages), layout components (AppShell, Sidebar, TopBar), GSAP mount animations per FRONTEND.md
6. **Admin UI** — 4 admin pages (StudentList, StudentDetail, StudentSessions, StudentAuditLog), paginated data tables with search, edit forms for XP/module/band, Cognito admin group guard
7. **Integration + Celery** — WebSocket ↔ Frontend session lifecycle wired, prompt builder fetches real student context via REST API, tool handler persists scores + validates level-ups, Celery async summarization task, playground XP daily cap enforced, level-up events forwarded to frontend

### Key Architecture Decisions Implemented

- **First-Message WebSocket Auth**: Browser WebSocket API cannot set custom headers; auth token sent in first JSON frame after `accept()` (Red Team Finding #4)
- **Dev Mode JWKS Bypass**: `ENVIRONMENT=development` skips JWT validation entirely when JWKS fetch fails, allows local dev without Cognito (Red Team Finding #3)
- **Internal Level-Up Security**: `POST /sessions/{id}/level-up` protected by `X-Internal-Secret` header (env var), not student token, prevents self-promotion (Red Team Finding #9)
- **Sync Celery Engine**: Celery tasks use sync SQLAlchemy engine to avoid `asyncio.run()` conflicts with async app event loop (Red Team Finding #7)
- **Playground XP Cap**: Daily XP from playground capped at 60% of module threshold, enforced with `SELECT FOR UPDATE` to prevent concurrent-session double-award (Red Team Finding #8)
- **Token Expiry Mitigation**: 45-min max session duration enforced server-side; Cognito tokens expire after 1hr, deferred WS refresh complexity for MVP (Validation Session answer #1)

### All Red Team Findings Accepted and Fixed

15 critical/high severity findings from parallel red team session (May 27, 2026) have been incorporated into implementation:
- Database mutation isolation (Finding #1)
- Session ID propagation (Finding #2)
- JWKS retry + dev fallback (Finding #3)
- WS auth before Bedrock (Finding #4)
- Idempotent placement confirmation (Finding #5)
- JWT error handling (Finding #6)
- Celery event loop (Finding #7)
- Playground XP race condition (Finding #8)
- Level-up endpoint security (Finding #9)
- Prompt builder HTTP timeouts (Finding #10)
- Transcript ownership validation (Finding #11)
- Admin list pagination cap (Finding #12)
- Module change audit logging (Finding #13)
- Access token expiry in WS (Finding #14)
- Session creation cleanup (Finding #15)

*Document version: 1.2 — Implementation complete*
*Last updated: May 27, 2026*