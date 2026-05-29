# Import all models so Alembic autogenerate can discover them via Base.metadata.
from app.db.models.student import Student
from app.db.models.module import Module, Class, Enrollment
from app.db.models.session import Session, SkillScore
from app.db.models.level_audit import LevelAuditLog
from app.db.models.playground_topic import PlaygroundTopic
from app.db.models.learning import AnalysisResult, StudentLearningProfile, StudyPlan
from app.db.models.memory import StudentMemory
from app.db.models.gamification import Streak, Achievement, StudentAchievement
from app.db.models.grammar import StudentGrammarWeakness, GrammarExercise
from app.db.models.vocab import StudentVocabulary, WordUnlock
from app.db.models.mock_test import MockTestResult

__all__ = [
    "Student",
    "Module",
    "Class",
    "Enrollment",
    "Session",
    "SkillScore",
    "LevelAuditLog",
    "PlaygroundTopic",
    "AnalysisResult",
    "StudentLearningProfile",
    "StudyPlan",
    "StudentMemory",
    "Streak",
    "Achievement",
    "StudentAchievement",
    "StudentGrammarWeakness",
    "GrammarExercise",
    "StudentVocabulary",
    "WordUnlock",
    "MockTestResult",
]
