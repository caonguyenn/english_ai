# EnglishAI Development Roadmap

**Project:** EnglishAI — AI-native IELTS Speaking Platform  
**Last Updated:** May 29, 2026  
**Status:** Phases 0–1 Complete | Phases 2–7 Planned

---

## Overall Vision

EnglishAI is a real-time English learning platform powered by Amazon Nova Sonic (speech-to-speech). Every lesson is a live conversation. The AI teaches, corrects, and promotes students automatically.

The development roadmap focuses on building a complete learning intelligence system that continuously adapts lessons based on student speaking performance.

---

## Phase Timeline

### Phase 0: Foundations ✓ COMPLETE

**Delivered:** May 29, 2026  
**Duration:** 1 day  
**Status:** Merged to master

**What:** Database UUID migration + audio fixes
- Migrate all PKs from INTEGER to UUIDv7 (time-ordered, index-friendly)
- Implement half-duplex audio mic gating tied to `audioOutput` WebSocket events
- Convert frontend IDs from `number` to `string`
- Fix scoping issues in `xp_in_module` calculation, `to_module_id` fallback

**Blockers cleared:** All subsequent phases

**Reference:** `plans/260529-0356-learning-intelligence-roadmap/phase-00-foundations.md`

---

### Phase 1: Analysis Engine ✓ COMPLETE

**Delivered:** May 29, 2026  
**Duration:** 1 day  
**Status:** Merged to master

**What:** Post-session Learning Intelligence via Amazon Nova Lite
- 3 new DB models: `AnalysisResult`, `StudentLearningProfile`, `StudyPlan`
- Nova Lite integration with JSON-schema enforcement and retry logic
- Transcript serialization with fluency metrics (wpm, hesitation rate, response length)
- Rolling student profile with exponential moving average (EMA) for band estimates
- Study plan generation with target band + focus areas + daily tips
- 27/27 unit + integration tests passing

**Impact:**
- Student performance now analyzed after every session
- Student learning profile continuously updated with skills assessment
- Study plans generated automatically based on weakness analysis
- Ready for consumer implementations (Phase 2+)

**Blockers cleared:** Phases 2, 4, 5, 7, 8

**Reference:** `plans/260529-0356-learning-intelligence-roadmap/phase-01-analysis-engine.md`  
**Docs:** `docs/learning-intelligence.md`, `docs/database-learning-model.md`

---

### Phase 2: Feedback & Memory UI ⏳ PLANNED

**Target:** June 2, 2026  
**Estimate:** 2–3 days  
**Status:** Blocked on Phase 1 (unblocked May 29)

**What:** Surface learning intelligence to students
- New REST endpoints: `GET /students/{id}/profile`, `GET /sessions/{id}/analysis`, `GET /students/{id}/memories`
- Post-session feedback panels (grammar corrections, vocab intro, band card)
- AI memory system: extract + persist student facts (name, job, interests, goals)
- Student profile card showing current band + trends + next milestones
- Recommended actions widget (practice areas from analysis)

**Success Criteria:**
- Students see personalized analysis after every session
- Band progression visible on dashboard
- AI references student facts in next session (memory)

---

### Phase 3: Gamification (Parallel to Phase 2)

**Target:** June 2, 2026  
**Estimate:** 2 days  
**Status:** Ready (independent of Phase 1)

**What:** Streaks, achievements, leaderboards
- 3 new tables: `streaks`, `achievements`, `student_achievements`
- Streak tracking (consecutive daily practice sessions)
- Achievement unlock logic (e.g., "5-session streak", "Band 5 milestone")
- XP multiplier for streaks
- Dashboard widgets: streak flame, achievements grid, XP bar

**Success Criteria:**
- Streak counter updates daily
- Achievements unlock and display
- XP multiplier applied to sessions with active streak

---

### Phase 4: Adaptive Grammar Practice ⏳ PLANNED

**Target:** June 5, 2026  
**Estimate:** 2–3 days  
**Status:** Blocked on Phase 1 (unblocked May 29)

**What:** Grammar exercises targeted to student weaknesses
- 2 new tables: `student_grammar_weaknesses`, `grammar_exercises`
- New endpoint: `GET /students/{id}/grammar-weaknesses`, `POST /students/{id}/grammar-exercises`
- Extract grammar weakness tags from `AnalysisResult` (Phase 1)
- Generate + store grammar practice exercises matching weakness categories
- Track exercise attempts + score + mastery progression
- Dashboard widget: "Recommended Grammar Practice" with practice drill button

**Success Criteria:**
- Grammar weaknesses populated from analysis
- Exercises generated matching weakness categories
- Exercise completion feeds back into student profile

---

### Phase 5: Adaptive Vocabulary ⏳ PLANNED

**Target:** June 7, 2026  
**Estimate:** 2–3 days  
**Status:** Blocked on Phase 1 (unblocked May 29)

**What:** Vocabulary mastery tracking + flashcards
- 2 new tables: `student_vocabulary`, `word_unlocks`
- Track vocabulary introduced in each session (from `AnalysisResult`)
- Vocabulary mastery progression (0–100 scale)
- Daily cap on "new word unlocks" to prevent overload
- Dashboard vocab widget showing growth rate + most recent words
- Optional: flashcard review pages with spaced repetition

**Success Criteria:**
- Vocabulary words tracked from analysis output
- Mastery score increases with session usage
- Vocab widget shows growth + recent additions

---

### Phase 6: Four-Stage Classroom Lessons ⏳ PLANNED

**Target:** June 9, 2026  
**Estimate:** 2–3 days  
**Status:** Blocked on Phase 1 (unblocked May 29)

**What:** Structured 4-stage classroom lessons
- New schema: `classes.stage_content` (JSONB array of 4 stages)
- New schema: `sessions.current_stage` to track progress within a lesson
- Stage 1: Vocabulary intro (5 min) — AI introduces 3–5 words for the topic
- Stage 2: Grammar warmup (5 min) — AI teaches/practices relevant grammar
- Stage 3: Speaking (15 min) — main conversational practice (existing)
- Stage 4: Feedback (3 min) — corrections + summary (new, leverages Phase 1 analysis)
- UI: 4-step progress bar; stage-specific instructions
- Session continues across all 4 stages uninterrupted

**Success Criteria:**
- Lessons flow through all 4 stages without restart
- Stage timing tracked and enforced
- Feedback stage shows real analysis from speaker performance

---

### Phase 7: IELTS Mock Test ⏳ PLANNED

**Target:** June 12, 2026  
**Estimate:** 2–3 days  
**Status:** Blocked on Phase 1 (unblocked May 29)

**What:** Full IELTS Speaking mock exam simulation
- New table: `mock_test_results`
- New session type: `SessionType.mock_test`
- 3-part mock structure: Part 1 (4 min intro), Part 2 (2 min cue card), Part 3 (5 min discussion)
- AI evaluates against IELTS rubric (fluency, coherence, lexical range, grammar accuracy)
- Final mock result: predicted band (5.0–9.0) with skill breakdown
- New pages: `MockTestHome`, `MockTestSession`, `MockTestResult`
- Result includes: band estimate, skill scores, areas for improvement, comparison vs. current module band

**Success Criteria:**
- Mock exam flows through 3 parts
- Band prediction is within ±0.5 of student's current profile band
- Results persisted and historical mock progress visible

---

### Phase 8: Weekly Reports ⏳ PLANNED

**Target:** June 14, 2026  
**Estimate:** 1–2 days  
**Status:** Blocked on Phase 1 (unblocked May 29)

**What:** Automated weekly learning summary emails
- New table: `weekly_reports` (student_id, week_start, week_end, report_json)
- Celery scheduled task: generate reports every Sunday 9am UTC
- Report includes: sessions completed, XP earned, band trends, key improvements, weaknesses to focus, recommended next week's focus
- Email delivery via AWS SES or SendGrid
- UI page: view past weekly reports on profile page

**Success Criteria:**
- Reports generated automatically each week
- Email delivery confirms receipt
- Report shows accurate summary of weekly activity

---

### Phase 9: Monetization (Future) ⏳ PLANNED

**Target:** July 2026  
**Estimate:** 3–5 days  
**Status:** Planned for later

**What:** Subscription + premium features
- Free tier: 5 sessions/week, playground only
- Pro tier: unlimited sessions, all modules, weekly reports, priority support
- Premium tier: 1-on-1 human tutoring booking, custom study plans
- Stripe integration for payment processing
- Subscription management UI (upgrade, cancel, receipt history)

---

## Dependency Graph

```
Phase 1 (Analysis Engine) ✓
    ├─→ Phase 2 (Feedback & Memory) ⏳
    ├─→ Phase 4 (Adaptive Grammar) ⏳
    ├─→ Phase 5 (Adaptive Vocabulary) ⏳
    ├─→ Phase 6 (Four-Stage Lessons) ⏳
    ├─→ Phase 7 (Mock Test) ⏳
    └─→ Phase 8 (Weekly Reports) ⏳

Phase 3 (Gamification) ⏳ [independent]
    └─→ Phase 2, 4, 6, 7 (optional: XP multipliers, achievement badges)
```

---

## Success Metrics (Overall)

| Metric | Target | Phase Introduced |
|---|---|---|
| Session completion rate | >70% | Phase 2 (with feedback) |
| Average time-to-level-up | 8 sessions | Phase 2 (with progress visibility) |
| Streaks active students | >60% | Phase 3 |
| Mock test correlation | ±0.5 bands | Phase 7 |
| Weekly report engagement | >50% open rate | Phase 8 |
| Grammar exercise completion | >40% | Phase 4 |
| Vocabulary mastery rate | 80% after 5 uses | Phase 5 |

---

## Known Constraints & Notes

1. **Pronunciation Analysis Deferred** — Phase 1 analysis omits pronunciation score (requires audio-level analysis, not just text). Planned for future audio-analysis phase.

2. **WebSocket Lifespan** — Max 45 min per session enforced server-side. Cognito tokens expire after 1 hr. Full token refresh in WebSocket deferred for MVP.

3. **Playground XP Cap** — Daily XP from free-practice capped at 60% of module threshold to keep structured classes valuable.

4. **Level-Up Cooldown** — Students cannot level-up more than once per 24 hours (enforced globally, not per-module).

5. **Dev Mode** — `ENVIRONMENT=development` bypasses Cognito JWT validation for local dev without AWS credentials.

---

## How to Track Progress

- **Real-time status:** Check `plans/260529-0356-learning-intelligence-roadmap/plan.md`
- **Phase details:** Read individual phase docs (e.g., `phase-02-feedback-and-memory.md`)
- **Completion reports:** Review `plans/reports/` directory for project manager updates
- **Code:** All implementation in `backend/app/` and `frontend/src/`

---

## Next Steps (Immediate)

1. **Phase 2 kickoff:** Design feedback UI components + AI memory extraction logic
2. **Phase 3 parallel:** Implement streak tracking + achievement unlock rules
3. **Testing:** Run real sessions with Phase 1 analysis to validate accuracy
4. **Docs:** Add API reference section for Phase 1 endpoints once Phase 2 REST routes are added
