# Learning Intelligence Database Design

> **PK/FK type:** ALL tables (existing + new) use **UUIDv7** primary keys, generated
> app-side via Python `uuid_utils.uuid7()` as the SQLAlchemy column `default`
> (PostgreSQL 16 has no native `uuidv7()`). UUIDv7 is time-ordered so it stays
> index-friendly. Existing INTEGER PKs are migrated to UUID in a Phase 0 clean reset
> (throwaway dev data). All FKs are `UUID REFERENCES <table>(id)`.
>
> **Pronunciation:** `pronunciation_score` is omitted from Phase 1 — it cannot be
> derived from a text transcript. A future audio-based phase will add it.

## student_learning_profiles

```sql
CREATE TABLE student_learning_profiles (
  student_id UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,

  estimated_band NUMERIC(3,1),

  fluency_score INTEGER,
  grammar_score INTEGER,
  vocabulary_score INTEGER,
  -- pronunciation_score deferred (requires audio analysis)

  strengths JSONB,
  weaknesses JSONB,

  updated_at TIMESTAMPTZ
);
```

---

## analysis_results

```sql
CREATE TABLE analysis_results (
  id UUID PRIMARY KEY,              -- uuid7() app-side default

  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,

  grammar_mistakes JSONB,           -- array of {category, original, corrected, severity, frequency}

  vocabulary_usage JSONB,           -- array of {word, level, mastery_delta}

  fluency_metrics JSONB,            -- {wpm, hesitation_rate, response_length, turn_count}

  band_estimate JSONB,              -- {overall, fluency, grammar, vocabulary, pronunciation: null, estimate_note}

  created_at TIMESTAMPTZ
);
```

Index: `(student_id, session_id)` for quick lookup during profile updates.

---

## student_vocabulary

```sql
CREATE TABLE student_vocabulary (
  id UUID PRIMARY KEY,              -- uuid7() app-side default

  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,

  word VARCHAR(255),

  mastery_score INTEGER,

  usage_count INTEGER,

  first_seen_at TIMESTAMPTZ,

  last_used_at TIMESTAMPTZ
);
```

---

## student_grammar_weaknesses

```sql
CREATE TABLE student_grammar_weaknesses (
  id UUID PRIMARY KEY,              -- uuid7() app-side default

  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,

  category VARCHAR(100),

  severity INTEGER,

  frequency INTEGER,

  updated_at TIMESTAMPTZ
);
```

---

## student_memories

```sql
CREATE TABLE student_memories (
  id UUID PRIMARY KEY,              -- uuid7() app-side default

  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,

  memory_type VARCHAR(100),

  memory_value TEXT,

  confidence_score INTEGER,

  updated_at TIMESTAMPTZ
);
```

Examples:

* job
* hobbies
* family
* goals
* interests

---

## study_plans

```sql
CREATE TABLE study_plans (
  id UUID PRIMARY KEY,              -- uuid7() app-side default

  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,

  target_band NUMERIC(3,1),

  generated_plan JSONB,

  created_at TIMESTAMPTZ
);
```
