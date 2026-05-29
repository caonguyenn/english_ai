# EnglishAI Platform: Full Implementation Plan Created & Red-Teamed

**Date**: 2026-05-27 07:33
**Severity**: Medium
**Component**: Architecture, Planning, Pre-Implementation
**Status**: Resolved

## What Happened

A complete implementation plan for the EnglishAI platform was researched, designed, and red-teamed in a single session. The platform is an AI-native English learning app where students have live spoken conversations with Amazon NovaSonic (S2S via AWS Bedrock). No passive content — students always speak, and the AI teaches and promotes them automatically.

The session moved through four phases:
1. **Brainstorm & Architectural Decisions** — read docs, CLAUDE.md, determined build order and parallelization strategy
2. **Plan Creation** — 7 phases spanning ~80 hours across fullstack (backend REST + WebSocket server, frontend React/Vite, PostgreSQL, Redis, Celery)
3. **Red Team Review** — 15 findings surfaced, including 6 Critical issues that would have caused silent data loss or runtime crashes
4. **Validation Interview** — 8 questions confirmed architectural choices

Plan saved to: `/home/caonguyen/english_ai/plans/260527-0402-englishai-platform-build/`

## The Brutal Truth

We nearly shipped a broken plan. The red team found **six critical architectural flaws** that would have led to:
- **Silent data loss**: session IDs never sent to WebSocket server → all skill scores dropped without error
- **Production outages**: JWKS startup with no retry → 500 error on network blip at boot
- **Data corruption**: confirm_placement mutation in wrong SQLAlchemy session → student fields silently reverted
- **Celery crashes**: async engine + asyncio.run() in Celery tasks → immediate failure
- **Race condition**: playground XP cap without SELECT FOR UPDATE → users could cap-bypass via concurrent requests

The frustrating part? These weren't minor oversights. They were **architectural decisions we'd made and documented** — and they were fundamentally broken. We had high confidence in the plan _until_ a hostile review tested every assumption.

This is exactly what a red team is for, but it stings because each one represents hours of debugging that we've now prevented. That's valuable. But it also means the original plan-writing was incomplete.

## Technical Details

### Critical Findings Applied

| Issue | Original Decision | Fix Applied |
|-------|-------------------|------------|
| WS Auth Header | "Send Authorization header" | First-message JSON `{"type":"auth","token":"...",session_id":N}` — browser WebSocket API can't set custom headers |
| session_id Lost | "WS server creates new session, backend records later" | **WS must send session_id in handshake JSON** — backend returns it, frontend stores it for future requests |
| JWKS Startup | "Fetch JWKS at startup" | Add exponential backoff retry (3 attempts, 2s→4s→8s) — fail fast if network is down, log clearly |
| confirm_placement Race | "Update student, return new module" | Use `refresh=True` after PATCH or re-query in same session — never rely on ORM object state post-commit |
| Celery + Async | "Use async engine in Celery tasks" | Create **sync engine only** for tasks (separate connection pool) — never mix asyncio.run() with FastAPI's event loop |
| Playground XP Race | "Check balance before awarding" | Use PostgreSQL `SELECT ... FOR UPDATE` on student row — prevent concurrent XP awards |

### Architecture Decisions Locked In

1. **Auth Pattern**: Explicit `POST /auth/register` (called by frontend after Cognito `confirmSignUp()`) instead of Lambda trigger. Simpler, local-dev compatible, idempotent, testable.

2. **Admin Auth**: `cognito:groups` JWT claim only — no admin column in students table. Reduces DB mutations.

3. **Level-Up Security**: WS server can trigger level-up, but **validates via X-Internal-Secret header** (shared env var with backend). Prevents XP farming attacks.

4. **Dev Auth Bypass**: `ENVIRONMENT=development` skips JWT signature verification. Makes local dev frictionless; never enabled in prod.

5. **No Payment Fields**: Deferred entirely (YAGNI). Payment routes stub to 501 Not Implemented.

6. **WS-Not-Ready UI**: Mic button disabled with "Session starting..." until WebSocket handshake completes. Prevents user confusion on slow connections.

## What We Tried

1. **First-pass design** — tried Lambda trigger for student creation, WS auth via Authorization header, async Celery tasks, playground XP cap without locking → **all rejected by red team**.

2. **Alternative WS auth** (considered but rejected):
   - URL query string `?token=...` → Security risk, tokens logged by proxies
   - Cookies → Browser sends automatically, but WebSocket API doesn't control them per-request
   - Settled on: First JSON message with token and session_id

3. **Celery task design** (considered):
   - Spawn separate event loop in tasks: `asyncio.run(async_work())` → Deadlock risk with FastAPI's event loop
   - Settled on: Dedicated sync SQLAlchemy engine for Celery workers only

## Root Cause Analysis

Why didn't we catch these in the initial plan?

1. **Assumption bias**: "JWT in header is standard REST" → forgot WebSocket API constraints (no custom headers)
2. **Incomplete flow mapping**: We designed REST + WS separately; didn't trace a full user session through both
3. **Sync/async confusion**: We had async everywhere (FastAPI, database), assumed Celery fits the same model → it doesn't
4. **Security theater**: "X-Internal-Secret is enough" without considering what prevents WS spoofing (nothing, until we wired session_id verification)
5. **No adversarial pressure**: The original plan was written collaboratively with no explicit "break this" review

## Lessons Learned

1. **Red team early, not late**: We've saved weeks of debugging by finding these issues now. The six critical flaws would each require 4-8 hours of production firefighting to discover and fix.

2. **Trace full flows, not components**: Planning backend REST and WS separately hid the session_id gap. Always follow a user action through all systems.

3. **Sync/async boundaries are sharp**: Mixing async (FastAPI) + sync (Celery) requires explicit architectural decisions. "It's all Python" doesn't bridge the gap.

4. **Security isn't additive**: We added X-Internal-Secret _after_ noticing WS level-up calls weren't authenticated. Should have designed threat model first.

5. **Browser APIs are constraints, not targets**: WebSocket API has real limitations (no custom headers). Design around them, don't assume they're problems to solve later.

6. **Locking matters at scale**: XP cap without SELECT FOR UPDATE is a ticking time bomb — won't fail in local dev, will fail under real load.

## Next Steps

1. **Implementation begins**: Phase 1 (DB + Backend Foundation) starts immediately. 12h estimate. Backend team leads this.

2. **Parallel execution approved**: Phase 3 (WebSocket) + Phase 4 (Frontend Auth) can run in parallel once Phase 1 is done (they have no direct dependencies). Estimated 18h total compression to ~14h.

3. **Red team follows each phase**: Every phase completion gets a 30min hostile review before merge to prevent regression.

4. **Lock decisions in code**: Each architectural decision (WS auth pattern, Celery engine split, X-Internal-Secret) gets a code comment linking back to this plan. Prevents cargo-cult changes later.

5. **Integration point: Phase 6**: Phase 1-5 are component-driven. Phase 6 ties everything together and adds Celery workers. This is where real system-level bugs surface — schedule aggressive testing.

## Emotional Reality

This session felt like defusing a bomb we didn't know we'd built. The planning was thorough, the design was reasonable — but without adversarial review, we were shipping critical flaws as "architecture."

The red team review was brutal and necessary. There's no anger here, just relief. Better to find six critical issues in a 2-hour review than in a 3am production incident where a student can't complete a session because session_id was never sent to WebSocket.

We also have a solid plan now. The uncertainty is gone. We know what needs to be built, in what order, and we've already killed the biggest architectural gotchas. That clarity is worth the pain of the red team review.

Implementation confidence: **High**. Let's build it.
