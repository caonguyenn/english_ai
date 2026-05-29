# EnglishAI Project Changelog

**Project:** EnglishAI — AI-native IELTS Speaking Platform  
**Format:** [Semantic Versioning](https://semver.org/) with phase tracking

---

## [Unreleased]

### Planned for Next Release
- Phase 2: Feedback & Memory UI (post-session analysis display, student facts extraction)
- Phase 3: Gamification (streaks, achievements, XP multipliers)
- Phase 4: Adaptive Grammar Practice (weakness-targeted exercises)
- Phase 5: Adaptive Vocabulary (mastery tracking, flashcards)
- Phase 6: Four-Stage Classroom Lessons (vocab intro → grammar warmup → speaking → feedback)
- Phase 7: IELTS Mock Test (3-part mock with band prediction)
- Phase 8: Weekly Reports (automated summaries, email delivery)

---

## [v1.2.0] — 2026-05-29 — Phase 1: Learning Intelligence

### Added

#### Database
- `student_learning_profiles` table — rolling student skill assessment (fluency, grammar, vocabulary scores with EMA updates)
- `analysis_results` table — post-session analysis output (grammar mistakes, vocabulary usage, fluency metrics, band estimate)
- `study_plans` table — automatically generated study plans (target band, focus areas, daily tips)
- Database indexes on `analysis_results(student_id, session_id)` for efficient profile updates

#### Backend Services
- `nova_client.py` — Amazon Nova Lite integration via boto3 `converse()` with JSON-schema enforcement and retry logic (max 3 retries on validation/service errors)
- `transcript_serializer.py` — convert turn-based transcript payloads to compact text; extract fluency metrics (wpm, hesitation_rate, avg_response_length, turn_count)
- `profile_updater.py` — rolling student profile updates with EMA for band estimates and merged strength/weakness lists
- `study_plan_generator.py` — generate personalized study plans from analysis results (target band, focus areas, recommended session types)
- `analyzer_prompt.py` — IELTS examiner system prompt for Nova Lite analysis

#### Configuration
- `NOVA_ANALYSIS_MODEL_ID` env var (default: `amazon.nova-lite-v1:0`) for configuring analysis model

#### Testing
- 27 comprehensive unit + integration tests covering all analysis pipeline components
- Tests include: schema validation, transcript serialization, profile updates, study plan generation, error handling

#### Documentation
- `docs/learning-intelligence.md` — full Learning Intelligence System specification with architecture, profile structure, and implementation status
- `docs/database-learning-model.md` — schema design for learning tables, indexes, and consumer documentation
- `docs/development-roadmap.md` — phase timeline and success metrics for all planned phases
- `docs/project-changelog.md` — this changelog

### Changed
- `backend/app/tasks/summarize.py` — integrated analysis pipeline post-session (graceful fallback if analysis fails)
- Session summarization now includes fluency metrics, grammar analysis, and vocabulary tracking
- Study plan generation runs automatically after analysis completes

### Fixed
- **H1:** Fluency metrics timestamp collection moved after word-limit truncation check (prevented double-counting)
- **H2:** `StudyPlan.generated_at` now set with `onupdate` clause (explicit setter in task)
- **H3:** Nova Lite client cached with thread-local pattern (eliminated per-call instantiation)
- **C1:** JSON schema enforcement wired via `toolConfig` + `toolChoice` in `nova_client.converse()`
- **C2:** Celery retries now fire on `ValidationError` + `BotoCoreError` (previously silent swallowing)

### Documentation
- Updated `docs/architecture-specification.md` Section 7 with new Learning Intelligence tables and Phase 1 architecture
- Updated implementation status to reflect Phase 0–1 completion and future phase roadmap

---

## [v1.1.0] — 2026-05-29 — Phase 0: Foundations & UUID Migration

### Added

#### Database
- UUID primary key migration (UUIDv7 app-side generation via `uuid_utils.uuid7()`)
- All PKs migrated: `students`, `modules`, `classes`, `sessions`, `skill_scores`, `level_audit_log`, `playground_topics`
- New migration: `1a0b59326492_nullable_from_module_id.py` for optional `from_module_id` in `level_audit_log`

#### Backend
- `uuid_utils` module for consistent UUIDv7 generation across backend services

#### Frontend
- Half-duplex audio mic gating via `audioOutput` WebSocket event handler
- Type updates throughout: ID types converted from `number` to `string` in stores, services, and components

#### Configuration
- Database migration strategy for UUID adoption (throwaway dev data, fresh schema)

### Fixed
- **Scoping:** `xp_in_module` calculation now checks current student/module context correctly
- **Nullability:** `to_module_id` fallback in `LevelAuditLog` view for missing data
- **Defaults:** `SessionResponse.xp_awarded` default value set to 0
- **UI:** PlacementSession stepper count corrected to reflect proper 4-session sequence

### Changed
- Frontend ID handling throughout all pages, stores, and components (`sessionStore`, `authStore`, types.ts, websocket.ts)
- Admin UI pages updated for string ID compatibility
- All API responses now use UUID strings instead of integers

---

## [v1.0.0] — 2026-05-27 — MVP Platform Complete

### Added

#### Database
- 7 core tables: `students`, `modules`, `classes`, `playground_topics`, `enrollments`, `sessions`, `skill_scores`, `level_audit_log`
- 28 curriculum classes (4 per module) with XP rewards
- 10 playground topics
- Alembic migration infrastructure with seed data

#### Backend (REST API — port 8000)
- 27 REST endpoints across auth, students, sessions, modules, playground, admin
- Cognito JWT validation with JWKS caching and dev mode bypass
- Level-up validation service with cooldown + min-session checks
- Admin routes with Cognito group authorization
- Celery async task queue for session summarization
- Playground XP daily cap (60% of module threshold) with `SELECT FOR UPDATE` race condition prevention
- Service layer: student service, session service, level-up service, module service

#### Backend (WebSocket Server — port 8080)
- Separate FastAPI process for NovaSonic audio streaming
- BedrockStreamManager for bidirectional Amazon Nova Sonic integration
- First-message auth pattern (browser WebSocket API limitation)
- Tool registration: `record_skill_score`, `trigger_level_up`
- Audio format validation (16-bit PCM 16kHz client → 24kHz server)

#### Frontend (React 18 + Vite + TypeScript)
- 8 student pages: Dashboard, Modules, ModulePage, ClassRoom, Playground, PlaygroundSession, PlacementSession, ProfilePage
- Layout components: AppShell, Sidebar, TopBar, AuthGuard, AdminGuard
- Cognito auth flow with AccessToken in memory + RefreshToken in HttpOnly cookie
- Zustand stores: `authStore` (tokens + profile), `sessionStore` (active NovaSonic session)
- Axios REST client with 401 token refresh queue
- React Router with protected + admin route guards
- GSAP mount animations per design specifications

#### Admin UI (4 pages)
- StudentList (paginated, searchable)
- StudentDetail (edit form for XP, module, band)
- StudentSessions (activity history)
- StudentAuditLog (level-up events)

#### Documentation
- `docs/architecture-specification.md` — full system design (vision, tech stack, schema, API reference, NovaSonic integration)
- `docs/FRONTEND.md` — frontend architecture and component guide
- `README.md` — setup, run commands, architecture overview

#### Testing
- Integration tests for core workflows (auth, session creation, level-up validation)
- Seed data for local development (7 modules, 28 classes, 10 topics)

### Security Fixes (Red Team Findings, May 27)
- **Finding #1:** Database mutation isolation via transaction semantics
- **Finding #2:** Session ID propagation across services
- **Finding #3:** JWKS retry + dev fallback for local dev
- **Finding #4:** WebSocket auth validation before Bedrock connection
- **Finding #5:** Idempotent placement confirmation (prevents double-provisioning)
- **Finding #6:** Proper JWT error handling with fallback
- **Finding #7:** Celery tasks use sync SQLAlchemy engine (avoids asyncio conflicts)
- **Finding #8:** Playground XP race condition prevention via `SELECT FOR UPDATE`
- **Finding #9:** Level-up endpoint protected by `X-Internal-Secret` header (prevents self-promotion)
- **Finding #10:** Prompt builder HTTP timeouts configured
- **Finding #11:** Transcript ownership validation before processing
- **Finding #12:** Admin list pagination cap (max 100 results)
- **Finding #13:** Module change audit logging to `level_audit_log`
- **Finding #14:** Access token expiry mitigation (45-min max session)
- **Finding #15:** Session creation cleanup on connection loss

---

## Release Notes History

### v1.0.0 Rationale
The MVP delivers the core EnglishAI platform: real-time NovaSonic conversations, curriculum-based learning paths, automatic level progression, and admin dashboard. Architecture separates WebSocket (real-time) from REST (data), enabling independent scaling. All red-team findings from the validation session were incorporated.

**Known Limitations (by design for MVP):**
- Pronunciation analysis deferred (requires audio-level processing)
- No human tutor booking (Phase 9)
- No email notifications (Phase 8)
- No mock test feature (Phase 7)
- Grammar/vocabulary tracking not adaptive yet (Phases 4–5)

---

## Version Compatibility

| Version | Python | Node | PostgreSQL | AWS Bedrock |
|---|---|---|---|---|
| v1.2.0 | 3.12+ | 20+ | 16+ | `amazon.nova-sonic-v1:0`, `amazon.nova-lite-v1:0` |
| v1.1.0 | 3.12+ | 20+ | 16+ | `amazon.nova-sonic-v1:0` |
| v1.0.0 | 3.12+ | 20+ | 16+ | `amazon.nova-sonic-v1:0` |

---

## Deployment Timeline

| Phase | Version | Status | Date | Duration |
|---|---|---|---|---|
| 1–7 (MVP) | v1.0.0 | ✓ Complete | May 27, 2026 | 7 days |
| Phase 0 (UUID) | v1.1.0 | ✓ Complete | May 29, 2026 | 1 day |
| Phase 1 (Analysis) | v1.2.0 | ✓ Complete | May 29, 2026 | 1 day |
| Phase 2–8 (Learning Intel) | v2.0.0 | ⏳ Planned | June 2–14, 2026 | 12 days |
| Phase 9 (Monetization) | v3.0.0 | ⏳ Planned | July 2026 | TBD |

---

## How to Read This Changelog

- **[Added]** — new features, endpoints, tables, services
- **[Changed]** — modifications to existing functionality
- **[Fixed]** — bug fixes and security patches
- **[Removed]** — deprecated features (rarely used in active development)
- **[Documentation]** — docs updates and migration guides

For full implementation details, see the phase docs in `plans/260529-0356-learning-intelligence-roadmap/`.
