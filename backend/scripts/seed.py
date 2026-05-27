"""Idempotent seed script: 7 modules × 4 classes + 10 playground topics.

Run from the backend/ directory:
    python scripts/seed.py
"""
import asyncio
import os
import sys

# Ensure the backend package root is on the path when run directly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select

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

        await db.commit()
        print("\nSeed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
