---
title: "EnglishAI v2 — Learning Intelligence Roadmap"
description: "Evolve EnglishAI into adaptive IELTS-speaking platform: post-session analysis engine (Nova Lite), AI memory, adaptive grammar/vocab, mock tests, gamification, monetization"
status: in-progress
priority: P1
effort: 200h+
branch: master
tags: [feature, ai, backend, frontend, database, analysis, gamification, monetization]
blockedBy: []
blocks: []
created: 2026-05-29
source_report: plans/reports/brainstorm-260529-0356-learning-intelligence-roadmap.md
---

# EnglishAI v2 — Learning Intelligence Roadmap

> Evolve the existing platform (built, completed 2026-05-27) into the `new_version.md`
> vision. **Evolve, don't rewrite.** Keep React+Vite+GSAP. All new data additive.

## Locked Decisions

- **Frontend:** keep React 18 + Vite + GSAP + Zustand. NO Next.js.
- **Analysis model:** `amazon.nova-lite-v1:0` via boto3 `bedrock-runtime` `converse()` + JSON schema. NOT Smithy SDK (streaming-only). Runs in existing `backend/app/tasks/summarize.py`.
- **Pronunciation:** DEFERRED (text LLM can't score acoustic features). Band = 3-skill estimate.
- **Schema:** new tables use `INTEGER FK → students.id`. Additive only.

## The Keystone

Phase 1 (Analysis Engine) is the foundation. Adaptive grammar (P4), adaptive vocab (P5),
mock-test scoring (P7), and weekly reports (P8) are all consumers of its output.
Build it first. It also removes the live tool-timing fragility by moving scoring
out of the conversation into a post-session pass.

## Dependency Graph

```
Phase 0 (Foundations)
    |
    v
Phase 1 (Analysis Engine) ★ KEYSTONE
    |
    +----------------+----------------+----------------+
    |                |                |                |
    v                v                v                v
Phase 2          Phase 4          Phase 5          Phase 7
(Feedback+Memory)(Adapt Grammar)  (Adapt Vocab)    (Mock Test)
                     |                |                |
                     +----------------+----------------+
                                      |
                                      v
                                 Phase 6 (4-Stage Lessons)
                                      |
                                      v
                                 Phase 8 (Weekly Reports)
                                      |
                                      v
                                 Phase 9 (Monetization)

Phase 3 (Gamification) — PARALLEL, no AI dependency, can start anytime after Phase 0
```

## Phases

| # | Phase | Status | Depends on | Effort | File |
|---|-------|--------|-----------|--------|------|
| 0 | Foundations | complete | — | ~12h | [phase-00-foundations.md](phase-00-foundations.md) |
| 1 | Analysis Engine (Nova Lite) ★ | complete | 0 | ~30h | [phase-01-analysis-engine.md](phase-01-analysis-engine.md) |
| 2 | Feedback UI + AI Memory | pending | 1 | ~24h | [phase-02-feedback-and-memory.md](phase-02-feedback-and-memory.md) |
| 3 | Gamification (parallel) | pending | 0 | ~20h | [phase-03-gamification.md](phase-03-gamification.md) |
| 4 | Adaptive Grammar | pending | 1 | ~24h | [phase-04-adaptive-grammar.md](phase-04-adaptive-grammar.md) |
| 5 | Adaptive Vocab + Word Unlock | pending | 1 | ~24h | [phase-05-adaptive-vocab.md](phase-05-adaptive-vocab.md) |
| 6 | 4-Stage Lessons | pending | 2,4,5 | ~20h | [phase-06-four-stage-lessons.md](phase-06-four-stage-lessons.md) |
| 7 | IELTS Mock Test | pending | 1 | ~24h | [phase-07-mock-test.md](phase-07-mock-test.md) |
| 8 | Weekly Reports | pending | 1,3 | ~16h | [phase-08-weekly-reports.md](phase-08-weekly-reports.md) |
| 9 | Monetization | pending | 2,7,8 | ~24h | [phase-09-monetization.md](phase-09-monetization.md) |

## Recommended Build Order

1. **Phase 0** → **Phase 1** (sequential, foundation)
2. **Phase 3** can run in parallel with Phase 1 (independent track)
3. **Phases 4, 5, 7** unblocked after Phase 1 (can parallelize)
4. **Phase 2** after Phase 1
5. **Phase 6** after 2/4/5 land
6. **Phase 8** after 1 + 3
7. **Phase 9** last

## Key Dependencies / Decisions Carried Into Phases

- **Turn timestamps** added to `transcript_json` in Phase 0 → enables real fluency metrics in Phase 1.
- **Study-plan cadence:** decided in Phase 1 (recommend on-demand regeneration after each analyzed session; weekly cron optional later).
- **Payments provider:** decided in Phase 9 (Stripe assumed; flag Vietnam-market alternatives like VNPay/MoMo for review).

## Cross-Cutting Coordination (from phase authoring)

- **`ws/app/services/prompt_builder.py`** is touched by Phases **2 (memory injection)**, **5 (word-unlock injection)**, and **7 (mock_test branch)**. Each is an *additive* prompt section. **Recommendation:** in Phase 2, refactor prompt assembly into a section-builder so later phases compose cleanly instead of conflicting. Phase 7's `mock_test` is a separate `session_type` branch (low conflict).
- **Append-only convention** for shared frontend files (`api.ts`, `types.ts`) and backend `router.py`, `db/models/__init__.py`, `scripts/seed.py`: each phase appends a labelled block — never edits another phase's lines. Lets parallel tracks (esp. Phase 3) merge without conflict.
- **Phase 0 is a hard gate for all UUID-FK tables.** Every new table assumes `students.id`/`sessions.id` are already UUID. Do not start Phases 1/3 table work until the Phase 0 reset lands.
- **`GET /classes/{id}` route location** — verify before Phase 6 adds `/classes/{id}/stages` (currently `modules.py` exposes `/modules/{id}/classes`; confirm no duplicate router).
- **Non-fatal hooks:** memory extraction (P2), gamification updates (P3), vocab/grammar accumulation (P4/P5) must wrap in try/except so a failure never breaks the already-committed session/analysis.

## Open Decisions (require user input at phase start)

1. **Payment provider (Phase 9, BLOCKING):** Stripe (build-time default) vs Vietnam-local (VNPay / MoMo / ZaloPay). Team/market appears VN-based at $9–15/mo where Stripe support is limited. Isolated behind a `BillingAdapter` so the swap is cheap, but the choice must be made before billing integration.
2. **Free-tier daily speaking-minute cap** (Phase 9): e.g. 10 vs 15 min.
3. **Study-plan cadence** (Phase 1): on-demand after each analyzed session (recommended) vs weekly cron.
4. **Mock-test cue-card mechanism** (Phase 7): dedicated `present_cue_card` tool (recommended) vs text-marker parse.
5. **Memory decay/expiry** (Phase 2): deferred (YAGNI) until stale memories prove harmful.

## Source Documents

- Design report: [brainstorm-260529-0356-learning-intelligence-roadmap.md](../reports/brainstorm-260529-0356-learning-intelligence-roadmap.md)
- Nova research: [researcher-260529-0407-amazon-nova-text-analysis.md](../reports/researcher-260529-0407-amazon-nova-text-analysis.md)
- Vision: docs/new_version.md, docs/learning-intelligence.md, docs/adaptive-learning-engine.md, docs/ai-memory-system.md, docs/database-learning-model.md
