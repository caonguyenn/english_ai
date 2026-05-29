# EnglishAI Product Vision

## Vision

EnglishAI is an AI-powered IELTS Speaking platform that helps learners improve their speaking ability through real-time conversation, personalized feedback, and adaptive learning paths.

Instead of focusing on traditional grammar lessons and vocabulary memorization, EnglishAI places speaking practice at the center of the learning experience.

The goal is to become:

> Duolingo for IELTS Speaking, powered by real-time AI conversation.

---

# Core Value Proposition

Most IELTS platforms provide:

* Mock tests
* Sample answers
* Grammar exercises
* Vocabulary lists

EnglishAI provides:

* Real-time AI conversations
* Personalized speaking feedback
* AI-generated study plans
* Adaptive grammar and vocabulary coaching
* Continuous progress tracking

Users learn English by speaking, not by reading theory.

---

# Learning Philosophy

Traditional approach:

Grammar → Vocabulary → Practice Speaking

EnglishAI approach:

Practice Speaking → Detect Weaknesses → Learn Grammar & Vocabulary → Practice Again

Speaking is the primary activity.

Grammar and vocabulary exist to support speaking improvement.

---

# Product Structure

## 1. AI Speaking Coach (Core Feature)

Real-time voice conversation powered by Amazon Nova Sonic.

The AI acts as:

* IELTS examiner
* English tutor
* Conversation partner
* Pronunciation coach

Capabilities:

* Natural voice conversations
* Context-aware follow-up questions
* Personalized discussions
* Memory of previous sessions

Example:

User:
"I work as a DevOps Engineer."

Next session:

"Last time you mentioned that you work as a DevOps Engineer. What is the most challenging part of your job?"

This creates a human-like learning experience.

---

## 2. Learning Path

### Beginner Foundations (IELTS 2–3)

Topics:

* Introduce Yourself
* Daily Routine
* Family & Friends
* Hobbies
* Food & Drinks

### Elementary Communicator (IELTS 3–4)

Topics:

* School & Work
* Travel
* Shopping
* Technology Basics

### Pre-Intermediate (IELTS 4–5)

Topics:

* Opinions
* Experiences
* Storytelling
* Personal Goals

### Intermediate Fluency (IELTS 5–6)

Topics:

* Education
* Environment
* Health
* Social Media

### Upper Intermediate (IELTS 6–7)

Topics:

* Technology
* Global Issues
* Work Culture
* Future Trends

### Advanced Expression (IELTS 7–8)

Topics:

* Abstract Thinking
* Debate
* Problem Solving
* Critical Discussion

### Expert Precision (IELTS 8–9)

Topics:

* Academic Discussion
* Policy Analysis
* Complex Argumentation
* Advanced Fluency

---

# Lesson Structure

Every lesson contains four stages:

## Stage 1: Vocabulary

Introduce key vocabulary related to the topic.

Example:

Topic: Environment

Vocabulary:

* pollution
* sustainable
* renewable
* conservation
* climate change

---

## Stage 2: Grammar Focus

Teach only grammar needed for the topic.

Example:

Topic: Past Experiences

Grammar:

* Past Simple
* Past Continuous

---

## Stage 3: AI Speaking Practice

User speaks with Nova Sonic.

Example:

"Tell me about an environmental issue in your city."

The AI guides the conversation naturally.

---

## Stage 4: Feedback

Generate personalized feedback.

Categories:

* Fluency
* Vocabulary
* Grammar
* Pronunciation ⏳ (deferred — needs audio; not in initial text-analysis phase)

Example:

Grammar:

❌ I go to school yesterday

✅ I went to school yesterday

Vocabulary:

Good use of:

* pollution
* sustainable

Suggested alternatives:

* issue → challenge
* good → beneficial

---

# Adaptive Grammar System

Grammar is not taught separately.

The system learns from mistakes made during conversations.

Example:

User frequently makes:

* Past tense errors
* Article mistakes
* Subject-verb agreement mistakes

The platform automatically creates exercises based on those mistakes.

Example:

Question:

She ___ to school every day.

A. go
B. goes

Correct answer:

B. goes

This creates a personalized grammar curriculum.

---

# Adaptive Vocabulary System

Track vocabulary usage during conversations.

Example:

Current vocabulary level:

B1

Known words:

* happy
* good
* nice

Suggested upgrades:

happy → delighted

good → excellent

nice → pleasant

The system gradually pushes learners toward higher IELTS vocabulary bands.

---

# Word Unlock System

When new vocabulary is introduced:

* environment
* sustainable
* renewable

The AI later encourages users to use those words during conversations.

If successfully used:

+20 XP

Vocabulary Mastered

This reinforces active vocabulary acquisition.

---

# IELTS Mock Test

Premium feature.

Simulate a complete IELTS Speaking exam.

### Part 1

* Home
* Work
* Studies
* Hobbies

### Part 2

Cue Card

1 minute preparation

2 minute speech

### Part 3

Discussion

Advanced follow-up questions

Output:

Estimated IELTS Band Score

Breakdown (official IELTS rubric has 4 criteria):

* Fluency & Coherence
* Lexical Resource
* Grammatical Range & Accuracy
* Pronunciation ⏳ (deferred — needs audio; band is a 3-criterion estimate until then)

---

# Progress Tracking

Track:

* Estimated IELTS Band (3-skill estimate initially)
* Speaking Time
* Vocabulary Growth
* Grammar Accuracy
* Pronunciation Score ⏳ (deferred — needs audio)

Weekly Reports:

Example:

This Week:

Band:
5.5 → 6.0

Vocabulary:
+45 words

Speaking Time:
120 minutes

---

# Gamification

## XP System

Activities:

* Complete lesson
* Practice speaking
* Master vocabulary
* Complete grammar exercises

Rewards:

* XP
* Badges
* Achievements

---

## Daily Streak

Examples:

🔥 7 Day Streak

🔥 30 Day Streak

🔥 100 Day Streak

---

## Achievements

Examples:

* First Conversation
* First Mock Test
* 1,000 Words Spoken
* 30-Day Streak
* Vocabulary Master

---

# AI Memory System

Store long-term learning context:

* Speaking level
* Vocabulary level
* Frequent mistakes
* User interests
* Previous discussions

Benefits:

* Personalized conversations
* Better follow-up questions
* Improved learning experience

---

# Technical Architecture

Frontend

* React 18 + Vite + TypeScript
* GSAP (animations)
* Zustand (state) + React Query (server state)

Backend

* FastAPI (REST :8000 + WebSocket :8080, separate processes)
* PostgreSQL 16 + SQLAlchemy 2.x async
* Redis 7 + Celery

AI Layer

* Amazon Nova Sonic (real-time voice, bidirectional streaming via Smithy SDK)
* Amazon Nova Lite (post-session text analysis, via boto3 converse())
* Bedrock Knowledge Base (optional)

Pipeline

Voice Input
↓
Nova Sonic Conversation
↓
Transcript (with turn timestamps)
↓
Analysis Engine (post-session, Nova Lite)
├── Grammar Analyzer
├── Vocabulary Analyzer
├── Fluency Analyzer (coherence/length from text)
└── IELTS Scoring Engine (3-skill estimate)
↓
Personalized Feedback
↓
Progress Tracking

> Pronunciation analysis is deferred — it requires acoustic/audio data and cannot
> be derived from a text transcript. A future audio-based phase will add it.

---

# Monetization

Free Plan

* Limited daily speaking minutes
* Basic feedback
* Beginner learning path

Pro Plan

* Unlimited speaking
* Full IELTS mock tests
* Advanced analytics
* AI memory
* Personalized study plans
* Progress reports

Target Pricing:

$9–15/month
