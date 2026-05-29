"""Stage content fetch + session stage update."""
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.module import Class
from app.db.models.session import Session
from app.schemas.lesson_stage import GrammarFocus, LessonStagesOut, VocabStageWord


async def get_stages(db: AsyncSession, class_id: object) -> LessonStagesOut:
    """Return stage definitions for a class. Empty if no stage_content."""
    cls = await db.get(Class, class_id)
    if not cls or not cls.stage_content:
        return LessonStagesOut()

    content = cls.stage_content
    vocab = [VocabStageWord(**w) for w in content.get("vocab", [])]
    gf_raw = content.get("grammar_focus")
    grammar_focus = GrammarFocus(**gf_raw) if gf_raw else None

    return LessonStagesOut(vocab=vocab, grammar_focus=grammar_focus)


async def set_stage(db: AsyncSession, session: Session, stage: int) -> Session:
    """Update session.current_stage (clamped 1-4)."""
    session.current_stage = max(1, min(4, stage))
    await db.flush()
    return session
