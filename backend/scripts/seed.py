"""Idempotent seed script: 7 modules × 4 classes + 10 playground topics + achievements.

Run from the backend/ directory:
    python scripts/seed.py
"""
import asyncio
import os
import sys

# Ensure the backend package root is on the path when run directly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session
from app.db.models.module import Class, Enrollment, Module, SkillType  # noqa: F401
from app.db.models.playground_topic import PlaygroundTopic

# ── Seed data ────────────────────────────────────────────────────────────────

MODULES = [
    {"order_index": 1, "band_min": 2.0, "band_max": 3.0, "title": "Beginner Foundations",     "xp_threshold": 500},
    {"order_index": 2, "band_min": 3.0, "band_max": 4.0, "title": "Elementary Communicator",  "xp_threshold": 600},
    {"order_index": 3, "band_min": 4.0, "band_max": 5.0, "title": "Pre-Intermediate",          "xp_threshold": 700},
    {"order_index": 4, "band_min": 5.0, "band_max": 6.0, "title": "Intermediate Fluency",      "xp_threshold": 800},
    {"order_index": 5, "band_min": 6.0, "band_max": 7.0, "title": "Upper Intermediate",        "xp_threshold": 900},
    {"order_index": 6, "band_min": 7.0, "band_max": 8.0, "title": "Advanced Expression",       "xp_threshold": 1000},
    {"order_index": 7, "band_min": 8.0, "band_max": 9.0, "title": "Expert Precision",          "xp_threshold": 1200},
]

# 4 classes per module: skill → xp_reward, order_index
CLASS_TEMPLATE = [
    {"skill_type": SkillType.speaking,      "xp_reward": 80, "order_index": 1},
    {"skill_type": SkillType.listening,     "xp_reward": 80, "order_index": 2},
    {"skill_type": SkillType.grammar,       "xp_reward": 70, "order_index": 3},
    {"skill_type": SkillType.pronunciation, "xp_reward": 70, "order_index": 4},
    {"skill_type": SkillType.vocabulary,    "xp_reward": 70, "order_index": 5},
]

PLAYGROUND_TOPICS = [
    {"slug": "nature-environment",    "title": "Nature & Environment"},
    {"slug": "family-relationships",  "title": "Family & Relationships"},
    {"slug": "travel-places",         "title": "Travel & Places"},
    {"slug": "technology-science",    "title": "Technology & Science"},
    {"slug": "food-culture",          "title": "Food & Culture"},
    {"slug": "current-events",        "title": "Current Events"},
    {"slug": "health-wellbeing",      "title": "Health & Wellbeing"},
    {"slug": "sports-hobbies",        "title": "Sports & Hobbies"},
    {"slug": "work-career",           "title": "Work & Career"},
    {"slug": "animals-wildlife",      "title": "Animals & Wildlife"},
]


# ── Gamification Achievements (Phase 3) ───────────────────────────────────────
ACHIEVEMENTS = [
    {
        "slug": "first-conversation",
        "title": "First Conversation",
        "description": "Complete your first session",
        "criteria_json": {"type": "session_count", "threshold": 1},
    },
    {
        "slug": "streak-7",
        "title": "7-Day Streak",
        "description": "Practice 7 days in a row",
        "criteria_json": {"type": "streak", "threshold": 7},
    },
    {
        "slug": "streak-30",
        "title": "30-Day Streak",
        "description": "Practice 30 days in a row",
        "criteria_json": {"type": "streak", "threshold": 30},
    },
    {
        "slug": "streak-100",
        "title": "100-Day Streak",
        "description": "Practice 100 days in a row",
        "criteria_json": {"type": "streak", "threshold": 100},
    },
    {
        "slug": "first-mock-test",
        "title": "First Mock Test",
        "description": "Complete your first IELTS mock test",
        "criteria_json": {"type": "mock_test_count", "threshold": 1, "deferred": True},
    },
    {
        "slug": "words-spoken-1000",
        "title": "1,000 Words Spoken",
        "description": "Use 1,000 different words in conversation",
        "criteria_json": {"type": "words_spoken", "threshold": 1000, "deferred": True},
    },
    {
        "slug": "vocabulary-master",
        "title": "Vocabulary Master",
        "description": "Master 50 target vocabulary words",
        "criteria_json": {"type": "vocab_mastered", "threshold": 50, "deferred": True},
    },
]


STAGE_DEFAULTS: dict[str, dict] = {
    "speaking": {
        "vocab": [
            {"word": "express", "meaning": "to show or say clearly"},
            {"word": "opinion", "meaning": "what you think about something"},
            {"word": "discuss", "meaning": "to talk about a topic"},
        ],
        "grammar_focus": {"category": "present_tense", "note": "Use present simple to state facts and opinions."},
    },
    "listening": {
        "vocab": [
            {"word": "understand", "meaning": "to get the meaning of"},
            {"word": "describe", "meaning": "to say what something is like"},
            {"word": "explain", "meaning": "to make something clear"},
        ],
        "grammar_focus": {"category": "question_forms", "note": "Use WH-questions to check understanding."},
    },
    "grammar": {
        "vocab": [
            {"word": "sentence", "meaning": "a complete thought with subject and verb"},
            {"word": "tense", "meaning": "the form of a verb showing when an action happens"},
            {"word": "clause", "meaning": "a group of words with subject and verb"},
        ],
        "grammar_focus": {"category": "past_tense", "note": "Use past simple for completed past actions."},
    },
    "pronunciation": {
        "vocab": [
            {"word": "stress", "meaning": "emphasis on a syllable or word"},
            {"word": "rhythm", "meaning": "the pattern of sounds in speech"},
            {"word": "intonation", "meaning": "the rise and fall of your voice"},
        ],
        "grammar_focus": {"category": "article", "note": "Use 'a', 'an', or 'the' correctly before nouns."},
    },
    "vocabulary": {
        "vocab": [
            {"word": "context", "meaning": "the situation in which a word is used"},
            {"word": "synonym", "meaning": "a word with a similar meaning"},
            {"word": "definition", "meaning": "the exact meaning of a word"},
        ],
        "grammar_focus": {"category": "collocations", "note": "Some words naturally go together — learn them as pairs."},
    },
}


async def seed_stage_content(db: AsyncSession) -> None:
    """Populate stage_content for all classes (idempotent — only sets if null)."""
    result = await db.execute(select(Class))
    classes = result.scalars().all()
    updated = 0
    for cls in classes:
        if cls.stage_content is not None:
            continue
        skill = cls.skill_type
        skill_str = skill.value if hasattr(skill, "value") else str(skill)
        content = STAGE_DEFAULTS.get(skill_str)
        if content:
            cls.stage_content = content
            updated += 1
    await db.commit()
    print(f"  + Seeded stage_content for {updated} classes")


async def seed() -> None:
    async with async_session() as db:
        # ── Modules + Classes ─────────────────────────────────────────────
        for mod_data in MODULES:
            result = await db.execute(
                select(Module).where(Module.order_index == mod_data["order_index"])
            )
            module = result.scalar_one_or_none()

            if module is None:
                module = Module(**mod_data)
                db.add(module)
                await db.flush()  # get module.id before inserting classes
                print(f"  + Module {mod_data['order_index']}: {mod_data['title']}")
            else:
                print(f"  ~ Module {mod_data['order_index']}: {mod_data['title']} (exists)")

            # Classes for this module
            for cls_data in CLASS_TEMPLATE:
                existing = await db.execute(
                    select(Class).where(
                        Class.module_id == module.id,
                        Class.skill_type == cls_data["skill_type"],
                    )
                )
                if existing.scalar_one_or_none() is None:
                    title = f"{mod_data['title']} — {cls_data['skill_type'].value.capitalize()}"
                    cls = Class(
                        module_id=module.id,
                        title=title,
                        skill_type=cls_data["skill_type"],
                        xp_reward=cls_data["xp_reward"],
                        order_index=cls_data["order_index"],
                    )
                    db.add(cls)
                    print(f"    + Class: {title}")

        # ── Playground Topics ─────────────────────────────────────────────
        for topic_data in PLAYGROUND_TOPICS:
            result = await db.execute(
                select(PlaygroundTopic).where(PlaygroundTopic.slug == topic_data["slug"])
            )
            if result.scalar_one_or_none() is None:
                db.add(PlaygroundTopic(**topic_data))
                print(f"  + Topic: {topic_data['slug']}")
            else:
                print(f"  ~ Topic: {topic_data['slug']} (exists)")

        # ── Gamification Achievements ─────────────────────────────────────
        from app.db.models.gamification import Achievement
        from app.db.base import _uuid7
        for ach_data in ACHIEVEMENTS:
            result = await db.execute(
                select(Achievement).where(Achievement.slug == ach_data["slug"])
            )
            if result.scalar_one_or_none() is None:
                db.add(Achievement(id=_uuid7(), **ach_data))
                print(f"  + Achievement: {ach_data['slug']}")
            else:
                print(f"  ~ Achievement: {ach_data['slug']} (exists)")

        await db.commit()

        # ── Stage Content (Phase 6) ───────────────────────────────────────
        await seed_stage_content(db)

        print("\nSeed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
