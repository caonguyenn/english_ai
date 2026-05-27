# Import all models so Alembic autogenerate can discover them via Base.metadata.
from app.db.models.student import Student
from app.db.models.module import Module, Class, Enrollment
from app.db.models.session import Session, SkillScore
from app.db.models.level_audit import LevelAuditLog
from app.db.models.playground_topic import PlaygroundTopic

__all__ = [
    "Student",
    "Module",
    "Class",
    "Enrollment",
    "Session",
    "SkillScore",
    "LevelAuditLog",
    "PlaygroundTopic",
]
