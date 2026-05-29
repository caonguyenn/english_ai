# EnglishAI System Architecture

**Last Updated:** May 29, 2026  
**Version:** 1.3 (Phase 0–1 Complete)

---

## Table of Contents

1. [High-Level Overview](#high-level-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow](#data-flow)
4. [Learning Intelligence Pipeline](#learning-intelligence-pipeline)
5. [Deployment Architecture](#deployment-architecture)
6. [Scalability Considerations](#scalability-considerations)
7. [Security Model](#security-model)

---

## High-Level Overview

EnglishAI is a real-time English learning platform where students speak with an AI tutor (Amazon Nova Sonic) powered by AWS Bedrock. The platform continuously analyzes performance and adapts lessons to student weaknesses.

### Core Principles

1. **Speaking-First Learning** — Every lesson is a live conversation; grammar and vocabulary support speaking, not the reverse
2. **AI-Driven Adaptation** — Post-session analysis automatically updates student profiles and generates personalized study plans
3. **Separation of Concerns** — WebSocket (real-time audio) and REST (data) run as separate processes
4. **Asynchronous Analysis** — Heavy computation (transcript analysis) runs post-session via Celery, not during conversation

---

## Component Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)                     │
│                          Port: 5173 (dev)                          │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │ Auth Pages   │  │ Student      │  │ Session UI           │    │
│  │ (Login,      │  │ Dashboard    │  │ (ClassRoom,          │    │
│  │ Placement)   │  │              │  │  PlaygroundSession)  │    │
│  └──────────────┘  └──────────────┘  └──────────────────────┘    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Zustand Stores: authStore, sessionStore                    │ │
│  │  Services: api.ts, websocket.ts                             │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────┬─────────────────────────────────────────────┘
                     │ REST (GET/POST/PATCH) + WebSocket (audio)
        ┌────────────┴────────────┐
        │                         │
┌───────▼──────────────┐ ┌────────▼──────────────┐
│  Backend REST API    │ │  WebSocket Server    │
│  (FastAPI)           │ │  (FastAPI)           │
│  Port: 8000          │ │  Port: 8080          │
│                      │ │                      │
│ ┌────────────────┐   │ │ ┌───────────────┐   │
│ │ Auth Routes    │   │ │ │ Session Route │   │
│ │ Students       │   │ │ │ (WS)          │   │
│ │ Sessions       │   │ │ │               │   │
│ │ Modules        │   │ │ │ Bedrock       │   │
│ │ Admin          │   │ │ │ Stream Mgr    │   │
│ └────────────────┘   │ │ └───────────────┘   │
│                      │ │                      │
│ ┌────────────────┐   │ │ ┌───────────────┐   │
│ │ Services:      │   │ │ │ Services:     │   │
│ │ - Student      │   │ │ │ - Nova Stream │   │
│ │ - Session      │   │ │ │ - Prompt      │   │
│ │ - Module       │   │ │ │   Builder     │   │
│ │ - LevelUp      │   │ │ │ - Tool        │   │
│ │ - Analysis     │   │ │ │   Handler     │   │
│ └────────────────┘   │ │ └───────────────┘   │
└──────────┬───────────┘ └─────────┬────────────┘
           │                       │
           └───────────┬───────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼───────┐ ┌────▼───────┐ ┌────▼────┐
   │ PostgreSQL │ │   Redis    │ │  Celery │
   │   Port     │ │ (Sessions, │ │ Workers │
   │   5432     │ │ Rate Limit)│ │         │
   │            │ │            │ │ Tasks:  │
   │ - Students │ │            │ │ - Summ- │
   │ - Modules  │ │            │ │   arize │
   │ - Sessions │ │            │ │ - Analy-│
   │ - Analysis │ │            │ │   sis   │
   │ - Profiles │ │            │ │ - Plans │
   └────────────┘ └────────────┘ └────────┘
        │
        └─────────────────┬──────────────────┐
                          │                  │
                    ┌─────▼──────┐   ┌──────▼─────┐
                    │ AWS Bedrock│   │ Cognito    │
                    │            │   │            │
                    │ - Nova     │   │ - JWT      │
                    │   Sonic    │   │   Validation
                    │   (S2S)    │   │ - JWKS     │
                    │ - Nova     │   │   Cache    │
                    │   Lite     │   │            │
                    │   (Text)   │   └────────────┘
                    └────────────┘
```

### Component Roles

| Component | Responsibility | Scaling | Notes |
|---|---|---|---|
| **Frontend** | React UI, auth flow, WebSocket client | CDN (static assets) | Single-page app (SPA) |
| **REST API** | CRUD operations, admin, business logic | Horizontal (stateless) | Port 8000 |
| **WebSocket** | Real-time NovaSonic streaming | Horizontal (sticky sessions) | Port 8080, separate process |
| **Celery Worker** | Async tasks (analysis, summarization) | Horizontal (fan-out) | One or more background workers |
| **PostgreSQL** | Persistent data (students, modules, sessions) | Read replicas (future) | Single primary, backups daily |
| **Redis** | Session state, rate limiting, task queue | High-availability cluster (future) | Ephemeral data OK to lose |
| **AWS Bedrock** | NovaSonic streaming, Nova Lite analysis | Managed service (AWS handles) | us-east-1 region |
| **Cognito** | User authentication, JWT issuance | Managed service (AWS handles) | Federated login (future) |

---

## Data Flow

### 1. Student Registration & Placement

```
1. Student signs up via Cognito Hosted UI
   ↓
2. Cognito triggers Post-Confirmation Lambda
   ↓
3. Lambda creates students row (cognito_sub = Cognito UUID)
   ↓
4. Frontend calls GET /auth/me → returns {placement_required: true}
   ↓
5. Frontend redirects to /placement
   ↓
6. PlacementSession WebSocket opens: WS /ws/session?type=placement
   ↓
7. NovaSonic conducts 4-part placement interview
   ↓
8. NovaSonic calls trigger_level_up(reason, evidence)
   ↓
9. Backend validates & assigns module 1 (Beginner Foundations, band 2.0–3.0)
   ↓
10. Frontend calls POST /auth/confirm-placement → placement_completed_at set
    ↓
11. Redirect to Dashboard
```

### 2. Class Session Lifecycle

```
1. Student selects class from module page
   ↓
2. Frontend calls POST /sessions → creates session record
   ↓
3. Frontend opens WS /ws/session?type=class&ref_id={class_id}
   ↓
4. WebSocket auth: send {token: "Bearer <AccessToken>"} in first frame
   ↓
5. Server fetches student context: profile, last 3 sessions, weaknesses
   ↓
6. Server builds NovaSonic system prompt with student context
   ↓
7. Server opens Bedrock bidirectional stream
   ↓
8. Audio exchange: student sends 16kHz PCM → server → Bedrock → student plays 24kHz PCM
   ↓
9. Transcript events sent to frontend for display
   ↓
10. NovaSonic calls tool: record_skill_score(skill, score, notes)
    ↓
    → Server persists to skill_scores table
    ↓
11. Student/AI finalize conversation (end-of-turn signal)
    ↓
12. Server closes WebSocket, persists transcript to sessions.transcript_json
    ↓
13. Server queues Celery task: summarize_session(session_id)
    ↓
14. Frontend calls PATCH /sessions/{id} → receives xp_awarded + summary
    ↓
15. Frontend displays post-session summary card (XP, areas improved, new vocab)
```

### 3. Post-Session Analysis (Async Celery Task)

```
Celery Worker receives: summarize_session(session_id)
    ↓
1. Fetch session transcript from DB
    ↓
2. Serialize transcript: convert turns to compact text
    ↓
3. Call Nova Lite via nova_client.converse():
   - System prompt: IELTS examiner
   - Input: serialized transcript
   - Output: JSON schema {grammar_mistakes, vocabulary_usage, fluency_metrics, band_estimate}
    ↓
4. Validate output against Pydantic schema (retry if invalid, max 3 retries)
    ↓
5. Persist to analysis_results table
    ↓
6. Update student_learning_profiles (rolling EMA for scores, merge strengths/weaknesses)
    ↓
7. Generate study_plan from analysis (target_band, focus_areas, daily_tips)
    ↓
8. Update sessions.summary_json with analysis output
    ↓
9. Return success (or fail gracefully if non-critical service)
```

---

## Learning Intelligence Pipeline

### Phase 1: Post-Session Analysis (May 29, 2026)

**Trigger:** Every class/playground session ends  
**Timing:** Asynchronous (Celery task, ~5–10 sec latency)  
**Model:** Amazon Nova Lite v1:0 (cheaper than Sonic, optimized for text analysis)

#### Analysis Components

1. **Transcript Serialization**
   - Convert turn-based JSON to compact text
   - Extract metadata: word count, response lengths, turn timing
   - Compute fluency signals: words-per-minute, hesitation rate

2. **Grammar Analysis**
   - Identify mistake categories (subject-verb agreement, tense errors, etc.)
   - Assign severity (minor, moderate, critical)
   - Track frequency (first occurrence vs. repeated)

3. **Vocabulary Analysis**
   - Extract words introduced in session
   - Classify by CEFR level (A1–C2)
   - Track mastery progression from context

4. **Fluency Analysis**
   - Coherence and topic development
   - Response length (indicating confidence)
   - Turn dynamics (interruptions, pauses)

5. **Band Prediction**
   - 3-skill estimate: fluency, grammar, vocabulary (pronunciation deferred)
   - Rolling aggregate: combine with historical scores
   - Confidence interval (±0.5 bands)

#### Student Learning Profile

Updated after every session with exponential moving average (EMA):

```json
{
  "student_id": "uuid",
  "estimated_band": 4.2,
  "target_band": 6.5,
  
  "fluency_score": 58,
  "grammar_score": 52,
  "vocabulary_score": 61,
  
  "strengths": [
    "topic_development",
    "natural_pausing",
    "collocation_usage"
  ],
  
  "weaknesses": [
    "third_conditional",
    "article_usage",
    "hesitation_on_complex_topics"
  ],
  
  "updated_at": "2026-05-29T14:22:33Z"
}
```

#### Study Plan Generation

Automatically generated from analysis, personalized recommendations:

```json
{
  "student_id": "uuid",
  "target_band": 6.5,
  
  "focus_areas": [
    "Conditional structures (3rd/4th)",
    "Complex sentence formation",
    "Collocations (verb+noun)"
  ],
  
  "recommended_session_types": [
    "grammar_practice",
    "vocabulary_exposure",
    "speaking_drill"
  ],
  
  "daily_tips": [
    "Practice 3rd conditional in context (hypothetical situations)",
    "Record yourself speaking; listen for hesitation points",
    "Study 5 new collocations daily; use in conversation"
  ],
  
  "generated_at": "2026-05-29T14:22:33Z"
}
```

#### Data Persistence

All analysis results persisted to `analysis_results` table with indices for quick lookup during profile updates:

```sql
CREATE INDEX idx_analysis_student_session 
  ON analysis_results(student_id, session_id);
```

---

## Deployment Architecture

### Local Development

```
docker-compose up -d

# Services running:
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
# - Backend: http://localhost:8000
# - WebSocket: ws://localhost:8080
# - Frontend: http://localhost:5173
```

### Production Deployment (Recommended)

**Compute:**
- Backend API: AWS ECS Fargate (containerized, auto-scaling)
- WebSocket: AWS ECS Fargate (separate cluster, sticky sessions)
- Celery Worker: AWS ECS Fargate or EC2 (background tasks)

**Data:**
- PostgreSQL: AWS RDS (managed, daily snapshots)
- Redis: AWS ElastiCache (managed, high availability)

**Frontend:**
- Static assets: AWS S3 + CloudFront CDN
- JavaScript bundles: Vite build output

**Auth:**
- AWS Cognito User Pool (identity)
- AWS Cognito Identity Pool (temporary AWS credentials)

**Monitoring:**
- CloudWatch logs + metrics
- X-Ray tracing (optional)
- Application Insights (observability dashboard)

### Environment Configuration

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/englishai

# Redis
REDIS_URL=redis://host:6379/0

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=***
AWS_SECRET_ACCESS_KEY=***

# Cognito
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_APP_CLIENT_ID=***
COGNITO_REGION=us-east-1

# Bedrock
BEDROCK_MODEL_ID=amazon.nova-sonic-v1:0
NOVA_ANALYSIS_MODEL_ID=amazon.nova-lite-v1:0

# App
ENVIRONMENT=production
REST_PORT=8000
WS_PORT=8080
LOG_LEVEL=INFO

# Level-up
LEVELUP_MIN_SESSIONS=5
LEVELUP_MIN_AVG_SCORE=70
LEVELUP_COOLDOWN_HOURS=24

# Playground
PLAYGROUND_XP_DAILY_CAP_PCT=60
```

---

## Scalability Considerations

### Horizontal Scaling

| Component | Strategy | Limits |
|---|---|---|
| **Backend REST** | Auto-scaling group (ECS) behind ALB | No session affinity needed |
| **WebSocket** | Auto-scaling group with sticky sessions | Session affinity required (same server for duration) |
| **Celery Workers** | Fan-out: multiple workers, Redis broker | Independent scaling, no affinity |
| **PostgreSQL** | Read replicas for analytics queries | Single primary for writes |
| **Redis** | ElastiCache cluster for high availability | Single shard sufficient for MVP |

### Database Optimization

1. **Indexes:**
   - `students(cognito_sub)` — fast lookup by Cognito UUID
   - `sessions(student_id, created_at DESC)` — recent session list
   - `analysis_results(student_id, session_id)` — profile update lookups
   - `skill_scores(session_id)` — session completion

2. **Query Patterns:**
   - Fetch student context (profile + last 3 sessions) → combine in application, not SQL joins
   - Level-up validation → index on `level_audit_log(student_id, created_at)` for cooldown check

3. **Archive Strategy:**
   - Transcripts: compress + move to S3 after 30 days (keep summary in DB)
   - Old sessions: archive to cold storage quarterly

### WebSocket Connection Management

- **Max concurrent sessions:** 10k per server (conservative estimate, actual depends on hardware)
- **Session timeout:** 45 min (Cognito token lifetime; defer complex refresh for MVP)
- **Reconnect strategy:** Client auto-reconnects on network loss; session continues if <5 min gap

---

## Security Model

### Authentication Flow

```
1. Student signs up → Cognito User Pool
   ↓
2. Cognito returns {IdToken, AccessToken, RefreshToken}
   ↓
3. Frontend:
   - Stores AccessToken in memory (not localStorage)
   - Stores RefreshToken in HttpOnly, Secure, SameSite cookie
   ↓
4. REST requests:
   - Header: Authorization: Bearer {AccessToken}
   - Backend validates via Cognito JWKS (cached at startup)
   ↓
5. WebSocket handshake:
   - Browser cannot set custom headers
   - Auth token sent in first JSON frame after accept()
   - Server validates, then opens Bedrock stream
```

### Authorization Model

- **Students:** Can only access own records (profile, sessions, progress)
- **Admins:** Can view/edit all students, audit logs (Cognito group: `admin`)
- **Devices:** Students can have multiple active devices; session is per-connection

### Data Protection

| Data | Protection | Comments |
|---|---|---|
| Passwords | AWS Cognito (bcrypt + MFA) | Never stored in EnglishAI DB |
| Tokens | HttpOnly cookie (HTTPS only) | Refresh token encryption optional |
| Transcripts | Encrypted in transit (HTTPS/WSS) | Encrypted at rest (RDS encryption) |
| Student names | PII (personally identifiable) | No PII logs; GDPR-compliant retention |
| Audio files | S3 encryption (optional archival) | Delete after 30 days (local policy) |

### Threat Mitigations

1. **Self-Promotion:** Level-up endpoint protected by `X-Internal-Secret` header (only backend→backend)
2. **XP Inflation:** Playground XP capped daily; enforced with `SELECT FOR UPDATE` in session service
3. **Token Theft:** AccessToken short-lived (1 hr); RefreshToken in HttpOnly cookie (not JavaScript-accessible)
4. **CSRF:** CORS whitelist; same-origin cookies (SameSite=Strict on RefreshToken)
5. **SQL Injection:** SQLAlchemy ORM with parameterized queries (no raw SQL)
6. **DoS:** Rate limiting on REST endpoints (100 req/min per IP); WebSocket connection limit

---

## Monitoring & Observability

### Key Metrics

- **Session completion rate:** % of sessions that reach end without error
- **Analysis latency:** Time from session end to profile update
- **Error rate:** % of failed operations (4xx, 5xx)
- **Bedrock latency:** Time to first token from NovaSonic
- **WebSocket connection duration:** Average session length
- **Database query latency:** P95 response time

### Logging

- **Application logs:** JSON format (structured logging) → CloudWatch
- **Access logs:** REST (ALB) + WebSocket (application) → CloudWatch
- **Error logs:** Full traceback + context → CloudWatch + Sentry (optional)
- **Audit logs:** Auth events, admin actions → `level_audit_log` table

### Alerts

- WebSocket connection errors >10%
- Analysis task failure >5%
- Database CPU >80% or disk >85%
- Bedrock service unavailable (fallback to error page)
- Cognito JWKS fetch failure (dev mode fallback)

---

## References

- **AWS Services:** [Bedrock](https://aws.amazon.com/bedrock/), [Cognito](https://aws.amazon.com/cognito/), [ECS](https://aws.amazon.com/ecs/), [RDS](https://aws.amazon.com/rds/), [ElastiCache](https://aws.amazon.com/elasticache/)
- **Frameworks:** [FastAPI](https://fastapi.tiangolo.com/), [SQLAlchemy](https://www.sqlalchemy.org/), [Celery](https://docs.celeryproject.io/)
- **Frontend:** [React](https://react.dev/), [Vite](https://vitejs.dev/), [Zustand](https://github.com/pmndrs/zustand)
