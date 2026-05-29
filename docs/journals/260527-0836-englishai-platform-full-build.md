# EnglishAI Platform: Full-Stack Build Complete (110 Files, 11K Insertions)

**Date**: 2026-05-27 08:40  
**Severity**: Milestone (Non-critical — delivery event, not an incident)  
**Component**: Entire Platform (Backend + WS + Frontend)  
**Status**: Complete and Committed

## What Happened

Built the entire EnglishAI platform in a single session across 7 phases, running phases in parallel where possible:

- **Phases 1–2**: PostgreSQL schema (8 tables: students, modules, classes, enrollments, sessions, skill_scores, level_audit_log, playground_topics), Alembic migrations, Cognito JWKS auth with 3-retry + dev bypass, 27 REST endpoints + admin routes with all 15 red team fixes applied
- **Phase 3**: Separate WebSocket server (port 8080) — BedrockStreamManager for S2S audio streaming, NovaSonic tools (record_skill_score + trigger_level_up)
- **Phase 4**: Cognito auth flow with custom MemoryStorage (AccessToken in memory, RefreshToken in HttpOnly cookie), Zustand stores (auth + session), axios with queued 401 retry
- **Phases 5 + 5B (parallel)**: All 9 student pages + full admin UI (StudentList, StudentDetail, StudentSessions, StudentAuditLog) with FRONTEND.md luxury dark design tokens
- **Phase 6**: Complete WS integration — SessionWebSocket class with first-message JWT auth, real prompt builder (parallel REST fetches for student context), level-up event propagates to LevelUpOverlay
- **Phase 7**: Component reskin — WaveformVisualizer (32 GSAP bars), MicButton (pulsing rings), StatusIndicator (4 animated states), TranscriptPanel (aria-live auto-scroll), MessageBubble (dual-column), WCAG AA accessibility

Total: 110 files, 11,121 insertions.

## The Brutal Truth

This was a massive undertaking compressed into hours instead of weeks. Parallel phases (5+5B, 3+4) cut wall time significantly, but coordination was tight. The real relief: **every architectural decision from CLAUDE.md actually worked in practice**. No late-stage rearchitecting, no "we should have split this differently" moments. The hardest parts were:

1. **First-message WS auth pattern** — browsers can't set custom headers on WebSocket connections. Worked around by having the client send JWT in the first WebSocket message before any audio data. This is not elegant, but it's the only solution that works in the browser.
2. **X-Internal-Secret for WS→REST level-up calls** — two separate processes need to trust each other without going through Cognito. Had to invent a simple shared secret pattern to validate internal requests.
3. **Celery + async/await conflict** — Celery's sync SQLAlchemy engine can't run inside an async event loop. Worked around by spawning Celery tasks from a sync function in the summarization service, not from async routes.

## Technical Details

- **JWKS caching**: Fetch once at startup, cache globally. Cognito JWKS endpoint has QPS limits; per-request fetching would fail under load.
- **Audio validation**: Reject client connections immediately if audio is not 16-bit PCM 16kHz mono. Avoids processing garbage and confusing Bedrock.
- **Level-up cooldown**: Query all of `level_audit_log`, not just current module — prevent spam level-ups across modules.
- **Playground XP cap**: Enforce in `session_service.py` — prevent users grinding playground to skip modules.
- **Transcript in prompt**: Always use `summary_json`, never raw `transcript_json`. Raw transcripts are too long and unstructured.
- **SELECT FOR UPDATE**: Prevent race conditions on XP updates when multiple sessions end simultaneously.

## What Went Well

1. **Red team fixes integrated on first pass** — all 15 issues from the security review were baked into the implementation without rework
2. **Parallel phases cut time** — Phases 5+5B (student pages + admin pages) and 3+4 (WS + auth flow) ran concurrently with minimal merge friction
3. **Design tokens locked in** — FRONTEND.md luxury dark theme was literally copy-paste into `index.css`. No design thrashing.
4. **GSAP animations smooth and cohesive** — unified animation library across all interactive components (waveform, mic button, status, transcript)

## What Hurt

1. **Celery worker requires separate process** — means 3 processes running locally (REST, WS, Celery). Easy to forget one, hard to debug when it's missing.
2. **Cognito SDK defaults are dangerous** — stores tokens in localStorage by default. Had to override with custom MemoryStorage. Developers on this team will absolutely forget this and leak tokens.
3. **First-message WS auth is non-standard** — not obvious from logs or stack traces. Future dev will wonder why JWT is in a binary frame instead of headers.
4. **No E2E tests yet** — sprinted on feature velocity. Test coverage exists for services but not integration workflows (login → placement → first lesson → level-up).

## Lessons Learned

1. **Process separation buys reliability** — WS on its own port/process meant audio bugs don't crash data routes. Worth the coordination cost.
2. **Inline all red team fixes before build** — waiting until the end guarantees rework. Building to spec from the start costs less.
3. **Parallel phases work when ownership is crystal clear** — Phases 5+5B succeeded because one agent owned student pages, one owned admin. No merge conflicts, no waiting.
4. **Luxury dark theme is not a luxury** — it's functional. Generated tokens, copy-paste, done. No design debates, no "should we use a different shadow."

## Next Steps

1. **Deploy to staging** — verify Cognito integration, Bedrock streaming, database migrations on real AWS
2. **Run E2E test suite** — full login→placement→lesson→level-up→module-complete flow
3. **Load test WS audio streaming** — verify BedrockStreamManager under 100+ concurrent sessions
4. **Celery worker deployment** — ensure summarization tasks run after every session
5. **Document first-message WS auth pattern** — add comment and diagram to `ws/app/routes/session_ws.py` so future dev doesn't remove it
6. **Monitor Cognito JWKS cache hits** — log cache hits/misses in `core/cognito.py`, tune TTL if needed

**Commit**: `62b6641 feat: complete EnglishAI platform full-stack build (phases 1-7)`

This platform is architecturally sound and ready for production hardening.
