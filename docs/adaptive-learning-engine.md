# Adaptive Learning Engine

## Goal

The platform should decide what a student needs next.

The student should never manually choose grammar lessons.

The system should recommend them automatically.

---

# Input

Sources:

* Session transcript
* Grammar weaknesses
* Vocabulary mastery
* Band prediction
* Learning goals
* Pronunciation history ⏳ (deferred — available only after the audio phase)

---

# Decision Engine

Priority Order:

1. Critical Grammar Errors
2. Vocabulary Gaps
3. Fluency Improvement
4. Topic Expansion
5. Pronunciation Problems ⏳ (deferred — needs audio data)

---

# Recommendation Types

## Vocabulary Practice

Example:

Student lacks:

* sustainable
* renewable
* conservation

Generate:

Environment vocabulary lesson

---

## Grammar Practice

Example:

Student repeatedly makes:

* Past tense mistakes

Generate:

Past Simple exercise

---

## Speaking Practice

Example:

Weak Topic:

Technology

Generate:

Technology speaking session

---

# XP Multipliers

Recommended content gives:

+100% XP

Normal content:

+50% XP

This encourages personalized learning.
