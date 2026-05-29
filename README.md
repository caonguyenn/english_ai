# EnglishAI Platform

An AI-native English learning platform built on Amazon NovaSonic (speech-to-speech via AWS Bedrock). Every lesson is a live spoken conversation — the AI teaches, corrects, and promotes students automatically.

## Features

- **Spoken lessons** — real-time bidirectional audio with Amazon NovaSonic (no text entry)
- **Placement assessment** — 6-question spoken test sets the student's starting IELTS band
- **Adaptive curriculum** — 7 modules × 4 skill classes (speaking, listening, grammar, pronunciation)
- **4-stage lessons** — Vocabulary intro → Grammar warmup → Speaking practice → Post-session feedback
- **Post-session analysis** — Nova Lite scores grammar, vocabulary, fluency, and estimates IELTS band
- **AI memory** — recalls student facts (job, goals, interests) across sessions
- **Adaptive grammar** — detects weaknesses, generates personalized MCQ exercises
- **Word Unlock** — AI introduces target vocabulary; +20 XP when student uses it in conversation
- **Gamification** — XP, daily streaks, achievement badges
- **IELTS mock test** — full 3-part simulated exam with cue card + band-breakdown results
- **Playground** — free-conversation mode on 10 topics

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + TypeScript + GSAP |
| Backend REST | Python 3.12 + FastAPI (port 8000) |
| WebSocket server | Python 3.12 + FastAPI (port 8080) |
| AI — speech | Amazon Nova Sonic via AWS Bedrock Smithy SDK |
| AI — analysis | Amazon Nova Lite via boto3 `converse()` |
| Auth | AWS Cognito (User Pool + Identity Pool) |
| Database | PostgreSQL 16 + SQLAlchemy 2.x async + Alembic |
| Cache / Queue | Redis 7 + Celery |

## Quick Start

### Prerequisites

- Docker + Docker Compose
- AWS credentials with Bedrock access (`us-east-1`)
- AWS Cognito User Pool (see [Cognito setup](#cognito-setup))

### 1. Configure environment

```bash
cp .env.example .env
# Fill in AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, COGNITO_USER_POOL_ID, COGNITO_APP_CLIENT_ID
```

```bash
cp frontend/.env.example frontend/.env
# Fill in VITE_COGNITO_USER_POOL_ID, VITE_COGNITO_APP_CLIENT_ID
```

### 2. Start the stack

```bash
docker compose up -d
```

Services started: `postgres`, `redis`, `backend` (:8000), `ws` (:8080), `celery`, `frontend` (:5173).

### 3. First-time: run migrations + seed

```bash
docker compose --profile init run --rm init
```

This applies all Alembic migrations and seeds modules, classes, playground topics, achievements, and stage content.

### 4. Open the app

```
http://localhost:5173
```

Register via Cognito → complete placement assessment → start learning.

## Manual Dev Setup (without Docker)

```bash
# Infrastructure
docker compose up -d postgres redis

# Backend REST
cd backend && pip install -r requirements.txt
cd backend && alembic upgrade head && python scripts/seed.py
cd backend && uvicorn app.main:app --reload --port 8000

# WebSocket server
cd ws && pip install -r requirements.txt
cd ws && uvicorn main:app --reload --port 8080

# Celery worker
cd backend && celery -A app.tasks.celery_app worker --loglevel=info

# Frontend
cd frontend && npm install && npm run dev
```

## Architecture

```
Browser (React + Vite)
  │
  ├─ REST (axios)  ──────────────→  backend/ (FastAPI :8000)
  │                                   ├─ Auth (Cognito JWKS)
  │                                   ├─ CRUD (students, sessions, modules...)
  │                                   └─ Celery tasks ──→ Nova Lite (analysis)
  │
  └─ WebSocket  ─────────────────→  ws/ (FastAPI :8080)
      PCM audio (16kHz mono)           └─ NovaSonic (Smithy SDK, bidirectional stream)
```

The REST and WebSocket servers are **separate processes** that never share code at runtime. `ws/` is DB-free — it reads all student context via REST calls to `backend/`.

## Cognito Setup

1. Create a User Pool in `us-east-1`
2. Add an App Client (no client secret)
3. Deploy `infra/lambda/post_confirmation.py` as a Post Confirmation trigger — this creates the `students` row on signup
4. Set `COGNITO_USER_POOL_ID` and `COGNITO_APP_CLIENT_ID` in `.env`

## Environment Variables

Key vars (see `.env.example` for the full list):

```env
DATABASE_URL=postgresql+asyncpg://englishai:password@localhost:5432/englishai
REDIS_URL=redis://localhost:6379/0
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
COGNITO_USER_POOL_ID=
COGNITO_APP_CLIENT_ID=
BEDROCK_MODEL_ID=amazon.nova-sonic-v1:0
NOVA_ANALYSIS_MODEL_ID=amazon.nova-lite-v1:0
INTERNAL_SECRET=change-me-in-production
```

## Project Structure

```
├── backend/        FastAPI REST API + Celery worker
├── ws/             FastAPI WebSocket server (NovaSonic streaming)
├── frontend/       React + Vite SPA
├── infra/lambda/   Cognito Post Confirmation trigger
├── docs/           Architecture, roadmap, specs, journals
└── plans/          Implementation plans + agent reports
```

See `CLAUDE.md` for full directory trees, database schema, API reference, and development conventions.

## License

Amazon Software License (ASL). See LICENSE file.
