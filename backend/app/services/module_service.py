"""Module and class queries with enrollment progress overlay."""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.module import Class, Enrollment, Module
from app.db.models.session import Session, SessionType, SkillScore
from app.schemas.module import ClassResponse, ModuleWithProgressResponse


class ModuleService:
    @staticmethod
    async def list_modules(
        db: AsyncSession, student_id: UUID
    ) -> list[ModuleWithProgressResponse]:
        """Return all modules with student enrollment XP overlay."""
        modules_result = await db.execute(
            select(Module).order_by(Module.order_index.asc())
        )
        modules = modules_result.scalars().all()

        # Fetch all enrollments for student in one query
        enroll_result = await db.execute(
            select(Enrollment).where(Enrollment.student_id == student_id)
        )
        enrollments = {e.module_id: e for e in enroll_result.scalars().all()}

        return [
            ModuleWithProgressResponse(
                id=m.id,
                band_min=m.band_min,
                band_max=m.band_max,
                title=m.title,
                description=m.description,
                xp_threshold=m.xp_threshold,
                order_index=m.order_index,
                xp_earned=enrollments[m.id].xp_earned if m.id in enrollments else 0,
                enrolled=m.id in enrollments,
            )
            for m in modules
        ]

    @staticmethod
    async def get_module(db: AsyncSession, module_id: UUID) -> Module | None:
        return await db.get(Module, module_id)

    @staticmethod
    async def list_classes(
        db: AsyncSession, module_id: UUID, student_id: UUID
    ) -> list[ClassResponse]:
        """Return classes for a module, with completed flag per student."""
        classes_result = await db.execute(
            select(Class)
            .where(Class.module_id == module_id)
            .order_by(Class.order_index.asc())
        )
        classes = classes_result.scalars().all()

        # A class counts as completed only when the student actually engaged with it:
        # the session must have ended AND have at least one recorded skill score.
        completed_result = await db.execute(
            select(Session.class_id)
            .join(SkillScore, SkillScore.session_id == Session.id)
            .where(
                Session.student_id == student_id,
                Session.session_type == SessionType.class_,
                Session.class_id.in_([c.id for c in classes]),
                Session.ended_at.isnot(None),
            )
        )
        completed_ids = {row[0] for row in completed_result.all()}

        return [
            ClassResponse(
                id=c.id,
                module_id=c.module_id,
                title=c.title,
                skill_type=c.skill_type.value,
                description=c.description,
                xp_reward=c.xp_reward,
                order_index=c.order_index,
                completed=c.id in completed_ids,
            )
            for c in classes
        ]
