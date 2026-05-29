# CLAUDE.md — EnglishAI Platform

> Read this file in full before writing any code, creating any file, or making any architectural decision.
> This is the single source of truth for all development on this project.

---

## What This Project Is

An AI-native English learning platform. Every lesson is a live, spoken conversation between the student and **Amazon NovaSonic** (speech-to-speech via AWS Bedrock). No passive content — students always speak. The AI teaches, corrects, and promotes them automatically.

Full product spec: `docs/architecture-specification.md`
Learning intelligence spec: `docs/learning-intelligence.md`
Development roadmap: `docs/development-roadmap.md`

---

## Monorepo Layout

```
english-ai-platform/
├── CLAUDE.md
├── docs/                    ← architecture, roadmap, specs, journals
├── plans/                   ← implementation plans + agent reports
├── docker-compose.yml       ← full stack: postgres + redis + backend + ws + celery + frontend
├── .env                     ← root env (backend + ws + celery)
├── frontend/                ← React 18 + Vite + TypeScript  (port 5173)
│   └── .env                 ← frontend-specific env
├── backend/                 ← FastAPI REST  (port 8000)
├── ws/                      ← FastAPI WebSocket  (port 8080)  ← SEPARATE process
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
| AI (speech) | `amazon.nova-sonic-v1:0` via AWS Bedrock Smithy SDK (`us-east-1`) |
| AI (analysis) | `amazon.nova-lite-v1:0` via boto3 `bedrock-runtime` `converse()` |
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
- **`ws/` is DB-free** — it reads all context via REST calls to `backend/`. Never import SQLAlchemy models in `ws/`.

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
- **NovaSonic (speech)**: use `aws_sdk_bedrock_runtime` (Smithy-based) — **NOT** `boto3 bedrock-runtime`. Bidirectional streaming requires Smithy.
- **Nova Lite (analysis)**: use `boto3` `bedrock-runtime` `converse()` with JSON schema. NOT Smithy SDK (streaming-only).

### Python conventions
- Python 3.12, type hints everywhere, no exceptions
- `async`/`await` throughout — zero blocking I/O on the event loop
- **Exception**: Celery tasks use sync SQLAlchemy (`create_engine` + `sessionmaker`) — never `asyncio.run()` + async engine in Celery
- Pydantic v2 for all schemas
- SQLAlchemy 2.x async ORM (`async with AsyncSession`) in routes/services
- All config via `pydantic-settings` reading from `.env` — never `os.environ` directly
- Services raise domain exceptions; routes catch and raise `HTTPException`
- UUIDv7 PKs via `uuid_utils.uuid7()` — use `app.db.base._uuid7` as SQLAlchemy `default`
- Tests: `pytest` + `pytest-asyncio`

### TypeScript conventions
- `"strict": true` — no `any`, use `unknown` if needed
- Zustand for global state; React Query (`@tanstack/react-query`) for server state
- **GSAP** (`gsap` npm package) for all animations — page transitions, waveform, micro-interactions. Use `gsap.context()` for React cleanup. Do NOT use Framer Motion or CSS keyframe animations for any animated component.
- `services/api.ts` — only place that calls REST API. New methods appended in labelled blocks per phase.
- `services/websocket.ts` — only place that manages WebSocket connections
- `types.ts` — all shared TS types. New types appended in labelled blocks per phase.
- Audio processing in Web Workers where possible

---

## Backend Directory Structure

```
backend/                         # REST API — port 8000
├── requirements.txt
├── alembic.ini
├── scripts/
│   └── seed.py                  # seed modules, classes, topics, achievements, stage_content
├── tests/
│   ├── unit/
│   └── integration/
└── app/
    ├── main.py
    ├── core/
    │   ├── config.py            # pydantic-settings — all env vars
    │   ├── cognito.py           # JWKS fetch (cached at startup) + token verify
    │   ├── dependencies.py      # get_current_student dependency
    │   ├── logging.py
    │   └── exceptions.py
    ├── db/
    │   ├── session.py           # async engine + session factory
    │   ├── base.py              # Base, UUIDPrimaryKey mixin, _uuid7()
    │   ├── models/
    │   │   ├── __init__.py      # imports ALL models (required for Alembic autogenerate)
    │   │   ├── student.py
    │   │   ├── module.py        # Module, Class (+ stage_content), Enrollment
    │   │   ├── session.py       # Session (+ current_stage), SkillScore, SessionType enum
    │   │   ├── level_audit.py   # LevelAuditLog
    │   │   ├── playground_topic.py
    │   │   ├── learning.py      # AnalysisResult, StudentLearningProfile, StudyPlan
    │   │   ├── memory.py        # StudentMemory
    │   │   ├── gamification.py  # Streak, Achievement, StudentAchievement
    │   │   ├── grammar.py       # StudentGrammarWeakness, GrammarExercise
    │   │   ├── vocab.py         # StudentVocabulary, WordUnlock
    │   │   └── mock_test.py     # MockTestResult
    │   └── migrations/versions/
    ├── schemas/                 # Pydantic v2 models
    │   ├── auth.py, student.py, session.py, module.py, analysis.py
    │   ├── feedback.py          # AnalysisOut, ProfileOut, MemoryOut
    │   ├── gamification.py      # StreakOut, AchievementOut
    │   ├── grammar.py           # GrammarWeaknessOut, GrammarExerciseOut, GrammarAnswerIn/Result
    │   ├── vocab.py             # VocabularyOut, WordUnlockOut
    │   ├── mock_test.py         # MockTestResultOut
    │   └── lesson_stage.py      # LessonStagesOut, StagePatchIn
    ├── api/v1/
    │   ├── router.py
    │   └── routes/
    │       ├── auth.py, students.py, sessions.py, modules.py, playground.py, admin.py
    │       ├── feedback.py      # GET /students/{id}/profile|memories, /sessions/{id}/analysis
    │       ├── gamification.py  # GET /students/{id}/streak|achievements
    │       ├── grammar.py       # GET weaknesses, POST exercises, POST answer
    │       ├── vocab.py         # GET /students/{id}/vocabulary|word-unlocks
    │       ├── mock_test.py     # GET /sessions/{id}/mock-result
    │       └── classes.py       # GET /classes/{id}/stages
    ├── services/
    │   ├── student_service.py, session_service.py, level_up_service.py, module_service.py
    │   ├── memory_service.py    # sync upsert_many (Celery-safe)
    │   ├── streak_service.py    # touch() — update streak on session end
    │   ├── achievement_service.py  # evaluate() + list_for_student()
    │   ├── mock_test_service.py # get_mock_result() — read view over analysis_results
    │   ├── lesson_stage_service.py # get_stages(), set_stage()
    │   ├── analysis/            # nova_client, analyzer_prompt, profile_updater,
    │   │                        # transcript_serializer, study_plan_generator, memory_extractor
    │   ├── grammar/             # aggregator, decision_engine, exercise_generator,
    │   │                        # exercise_prompt, grammar_service
    │   └── vocab/               # mastery, target_words, vocab_service, word_unlock_service
    └── tasks/
        ├── celery_app.py
        └── summarize.py         # post-session pipeline: summary → analysis → memory →
                                 # grammar aggregation → vocab fold → word-unlock detection
```

```
ws/                              # WebSocket server — port 8080
├── main.py
└── app/
    ├── routes/session_ws.py     # WS /ws/session endpoint
    └── services/
        ├── bedrock_stream.py    # BedrockStreamManager (Smithy SDK)
        ├── bedrock_events.py    # event parsing helpers
        ├── tool_handler.py      # record_skill_score, complete_class, trigger_level_up
        ├── prompt_builder.py    # section-builder pattern — assembles NovaSonic prompt
        ├── prompt_constants.py  # _PERSONA, _CORRECTION_STYLE, placement instructions
        └── prompt_mock_test.py  # 3-part IELTS examiner script
```

---

## Frontend Directory Structure

```
frontend/src/
├── App.tsx                      # router + auth guard + all routes
├── types.ts                     # ALL shared TS types (append-only per phase)
├── services/
│   ├── api.ts                   # axios instance + all REST calls (append-only per phase)
│   └── websocket.ts             # NovaSonic WS session manager
├── store/
│   ├── authStore.ts             # Cognito tokens, student profile (Zustand)
│   └── sessionStore.ts          # active NovaSonic session state (Zustand)
├── hooks/
│   ├── useAuth.ts, useAudioCapture.ts, useAudioPlayback.ts
│   ├── useWebSocket.ts, useTranscript.ts
├── components/
│   ├── layout/                  # AppShell, Sidebar, TopBar
│   ├── session/
│   │   ├── SessionBar.tsx, SessionSummary.tsx, LevelUpOverlay.tsx
│   │   ├── feedback/            # GrammarMistakes, VocabPanel, BandCard, PronunciationComingSoon
│   │   └── stages/              # StageStepper, VocabIntroStage, GrammarFocusStage,
│   │                            # SpeakingStage, FeedbackStage
│   ├── gamification/            # StreakFlame, AchievementsGrid, AchievementBadge
│   ├── practice/                # GrammarExerciseCard
│   ├── vocab/                   # VocabularyGrowthWidget, WordUnlockBadge
│   ├── dashboard/               # RecommendedPractice
│   └── mock-test/               # PartStepper, CueCard, PrepTimer
└── pages/
    ├── auth/LoginPage.tsx
    ├── Dashboard.tsx, PlacementSession.tsx
    ├── modules/                 # ModulePage, ClassRoom (4-stage shell), ModulesList
    ├── playground/              # PlaygroundHome, PlaygroundSession
    ├── profile/ProfilePage.tsx
    ├── practice/GrammarPractice.tsx
    └── mock-test/               # MockTestHome, MockTestSession, MockTestResult
```

---

## Database Schema

```sql
-- Core
students        (id UUID, cognito_sub UNIQUE, name, email, current_module_id, placement_band, xp_total, ...)
modules         (id UUID, band_min, band_max, title, description, xp_threshold, order_index)
classes         (id UUID, module_id, title, skill_type, description, system_prompt_addendum, xp_reward,
                 order_index, stage_content JSONB)   ← stage_content: {vocab:[{word,meaning}], grammar_focus:{category,note}}
enrollments     (student_id, module_id, xp_earned, started_at, completed_at)
playground_topics (id UUID, slug UNIQUE, title, description, difficulty_band)

-- Sessions
sessions        (id UUID, student_id, class_id?, topic_id?, session_type, started_at, ended_at,
                 transcript_json, summary_json, xp_awarded, current_stage SMALLINT)
skill_scores    (id UUID, session_id, skill, score 0-100, notes, recorded_at)
level_audit_log (id UUID, student_id, from_module_id, to_module_id, session_id, reason_text, evidence_json, ...)

-- Learning intelligence (Phase 1)
analysis_results       (id UUID, session_id UNIQUE, student_id, grammar_mistakes JSON,
                        vocab_usage JSON, fluency_metrics JSON, band_estimate JSON, raw_nova_output JSON, ...)
student_learning_profiles (id UUID, student_id UNIQUE, fluency_band, grammar_band, vocabulary_band,
                           overall_band, strengths JSON, weaknesses JSON, mistake_frequencies JSON,
                           vocab_mastery JSON, sessions_analyzed, updated_at)
study_plans            (id UUID, student_id UNIQUE, source_analysis_id, generated_plan JSON, generated_at)

-- AI Memory (Phase 2)
student_memories       (id UUID, student_id, memory_type, memory_value, confidence_score INT,
                        source_session_id?, UNIQUE(student_id, memory_type, memory_value))

-- Gamification (Phase 3)
streaks                (student_id PK, current_len, longest_len, last_active_date DATE)
achievements           (id UUID, slug UNIQUE, title, description, criteria_json JSONB)
student_achievements   (student_id, achievement_id, earned_at, PRIMARY KEY(student_id, achievement_id))

-- Adaptive Grammar (Phase 4)
student_grammar_weaknesses (id UUID, student_id, category, frequency, severity FLOAT, times_seen,
                            UNIQUE(student_id, category))
grammar_exercises      (id UUID, student_id, category, question_json JSON, answered_correctly BOOL?,
                        created_at, answered_at?)

-- Adaptive Vocab (Phase 5)
student_vocabulary     (id UUID, student_id, word, usage_count, mastery_score FLOAT,
                        first_seen_at, last_used_at, UNIQUE(student_id, word))
word_unlocks           (id UUID, student_id, session_id, word, introduced_at, used_at?, xp_awarded)

-- Mock Test (Phase 7)
mock_test_results      (id UUID, session_id UNIQUE, parts_completed JSON, cue_card_topic TEXT, ...)
```

Enums:
- `skill_type` / `skill`: `speaking | listening | grammar | pronunciation`
- `session_type`: `class | playground | placement | mock_test`

---

## API Reference

### REST — port 8000 (`/api/v1`)

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | public |
| GET | `/auth/me` | profile + `placement_required` flag |
| POST | `/auth/confirm-placement` | sets module + placement_completed_at |
| GET/PUT | `/students/{id}` | own record only |
| GET | `/students/{id}/progress` | XP, module, weak areas |
| GET | `/students/{id}/audit-log` | level-up history |
| GET | `/students/{id}/history` | recent sessions |
| GET | `/students/{id}/profile` | learning profile (band estimates) |
| GET | `/students/{id}/memories` | AI memories above confidence threshold |
| GET | `/students/{id}/streak` | current + longest streak |
| GET | `/students/{id}/achievements` | earned/locked overlay |
| GET | `/students/{id}/grammar-weaknesses` | ordered by severity×frequency |
| POST | `/students/{id}/grammar-exercises` | generate MCQ; answer key NOT in response |
| GET | `/students/{id}/vocabulary` | tracked words + mastery |
| GET | `/students/{id}/word-unlocks` | unlock history |
| GET | `/modules` | all modules + student progress overlay |
| GET | `/modules/{id}` | |
| GET | `/modules/{id}/classes` | with completion status |
| GET | `/classes/{id}` | |
| GET | `/classes/{id}/stages` | vocab + grammar_focus for 4-stage lessons |
| POST | `/sessions` | create at session start |
| PATCH | `/sessions/{id}` | update on end (transcript, xp_awarded) |
| PATCH | `/sessions/{id}/stage` | update current_stage (1-4) |
| POST | `/sessions/{id}/scores` | append skill score |
| GET | `/sessions/{id}/analysis` | post-session analysis (pending if Celery hasn't run) |
| GET | `/sessions/{id}/mock-result` | IELTS band breakdown (pending until analysis lands) |
| POST | `/grammar-exercises/{id}/answer` | grade answer; returns correct option + XP |
| GET | `/playground/topics` | |

### WebSocket — port 8080

```
WS /ws/session?type=class&ref_id={class_id}
WS /ws/session?type=playground&ref_id={topic_id}
WS /ws/session?type=placement
WS /ws/session?type=mock_test
Header: Authorization: Bearer <AccessToken>
```

Binary frames = PCM audio. JSON frames = control events (`levelUp`, `classComplete`, `error`).

---

## NovaSonic Tools

```python
record_skill_score(skill: str, score: int, notes: str)
# Call at session end for each practiced skill.

trigger_level_up(reason: str, evidence: dict)
# Call ONLY when confident student has mastered the module.
# evidence = { avg_scores: {...}, sessions_reviewed: N, key_improvements: [...] }

complete_class(reason: str)
# Call at end of a class session (NOT playground, NOT placement, NOT mock_test).
```

`mock_test` sessions: **no `complete_class`** — scoring is 100% post-session via Phase 1 analysis.

## NovaSonic System Prompt (`prompt_builder.py`)

Uses a **section-builder pattern** — each section is a pure function returning a string fragment:

1. `_PERSONA` + student name/XP + module info (always)
2. Weak-areas reminder (if any)
3. Last-1 session summary (condensed — **never** raw `transcript_json`)
4. `_memory_section` — AI memories above `MEMORY_INJECT_MIN_CONFIDENCE` (Phase 2)
5. `_word_unlock_section` — pending target words to introduce (Phase 5)
6. `_session_type_block` — class / playground / placement / mock_test branch
7. `_tool_instructions` — tool call instructions per session type
8. `_OUTPUT_STYLE` (always)

To add a new section: write a helper `_my_section(ctx) -> str` and insert one call in `_build_with_context`. Never rewrite existing sections.

---

## Post-Session Celery Pipeline (`summarize.py`)

Runs after every session end. Steps in order, each non-fatal (failure logged, pipeline continues):

1. Heuristic summary → `session.summary_json`
2. Nova Lite analysis → `analysis_results` + `student_learning_profiles` + `study_plans`
3. Memory extraction → `student_memories` (Nova Lite, allow-listed types only)
4. Grammar aggregation → `student_grammar_weaknesses` (rolling severity×frequency)
5. Vocab fold → `student_vocabulary` (mastery deltas) + word-unlock detection (+20 XP)

---

## Level-Up: Two-Stage Model

1. NovaSonic calls `trigger_level_up(reason, evidence)`
2. `level_up_service.py` validates:
   - ≥ `LEVELUP_MIN_SESSIONS` sessions in current module (default 5)
   - avg skill score ≥ `LEVELUP_MIN_AVG_SCORE` across last N sessions (default 70)
   - no level-up in last `LEVELUP_COOLDOWN_HOURS` hours (default 24) — check entire `level_audit_log`
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
NOVA_ANALYSIS_MODEL_ID=amazon.nova-lite-v1:0

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

# Memory injection
MEMORY_INJECT_MIN_CONFIDENCE=60
MEMORY_INJECT_MAX_COUNT=8

# Internal service-to-service secret (WS → REST level-up endpoint)
INTERNAL_SECRET=change-me-in-production

# Grammar practice XP
GRAMMAR_BASE_XP=10
RECOMMENDED_XP_MULTIPLIER=2.0
```

---

## Local Dev Commands

```bash
# Full stack (recommended)
docker compose up -d

# First-time: run migrations + seed
docker compose --profile init run --rm init

# OR manual (without Docker)
cd backend && uvicorn app.main:app --reload --port 8000
cd ws && uvicorn main:app --reload --port 8080
cd backend && celery -A app.tasks.celery_app worker --loglevel=info
cd frontend && npm run dev

# Migrations
cd backend && alembic upgrade head
cd backend && alembic revision --autogenerate -m "description"

# Seed (idempotent)
cd backend && python scripts/seed.py
```

---

## Common Gotchas

- **Bedrock SDK split**: Smithy SDK for NovaSonic (bidirectional streaming); boto3 `converse()` for Nova Lite (text analysis). Never swap them.
- **Celery sync engine**: Celery workers use `create_engine` (sync psycopg2), NOT asyncpg. Never use `asyncio.run()` + async engine inside a Celery task.
- **JWKS caching**: fetch once at startup, cache globally. Never fetch per request.
- **WS is DB-free**: `ws/` fetches all context via REST. Never import `app.db` models in `ws/`.
- **Answer key hiding**: grammar exercise create response NEVER includes `answer`/`explanation` — only returned in the grade response.
- **XP idempotency**: word-unlock XP guarded by `used_at IS NULL`. Grammar exercise XP guarded by `answered_correctly IS NULL`. Never award twice.
- **Enum migration**: adding values to a Postgres enum (`session_type_enum`) requires `ALTER TYPE ... ADD VALUE IF NOT EXISTS` via `op.execute` — cannot run inside a transaction block.
- **Audio validation**: reject WS connections immediately if audio is not exactly 16-bit PCM 16kHz mono.
- **Playground XP cap**: enforced in `session_service.py` — check today's playground XP before awarding.
- **Level-up cooldown**: query all of `level_audit_log` for the student, not just the current module's entries.
- **Post-Confirmation Lambda**: must be deployed and wired to Cognito before any user registers. Creates the `students` row. Without it, `/auth/me` returns 404.
- **Raw transcript in prompt**: never inject `transcript_json` directly — always use `summary_json`. Raw transcripts are too long.
- **Null `stage_content`**: classes without seeded `stage_content` fall back to legacy single-stage behavior (jump directly to Stage 3). This is intentional.
- **`mock_test` no `complete_class`**: scoring is post-session via Phase 1 analysis. The `tool_handler.py` guards `complete_class` to no-op for mock_test.
- **`api.ts` + `types.ts` are append-only**: new phases add clearly labelled blocks at the END of these files. Never edit existing lines to avoid merge conflicts between phases.

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
