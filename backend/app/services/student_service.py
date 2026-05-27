"""Student business logic — all DB mutations go through here."""
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.level_audit import LevelAuditLog
from app.db.models.module import Module
from app.db.models.session import Session, SkillScore
from app.db.models.student import Student
from app.schemas.student import AuditLogEntry, StudentHistory, StudentProgress


class StudentService:
    @staticmethod
    async def get_by_cognito_sub(db: AsyncSession, sub: str) -> Student | None:
        result = await db.execute(select(Student).where(Student.cognito_sub == sub))
        return result.scalar_one_or_none()

    @staticmethod
    async def create_from_token(
        db: AsyncSession, sub: str, email: str, name: str | None
    ) -> Student:
        student = Student(cognito_sub=sub, email=email, name=name or "", xp_total=0)
        db.add(student)
        await db.commit()
        await db.refresh(student)
        return student

    @staticmethod
    async def update(db: AsyncSession, student: Student, name: str | None) -> Student:
        if name is not None:
            student.name = name
        await db.commit()
        await db.refresh(student)
        return student

    @staticmethod
    async def get_progress(db: AsyncSession, student: Student) -> StudentProgress:
        module_title: str | None = None
        xp_threshold = 0
        xp_in_module = 0

        if student.current_module_id is not None:
            module = await db.get(Module, student.current_module_id)
            if module:
                module_title = module.title
                xp_threshold = module.xp_threshold

            # Sum XP earned in current module via sessions
            xp_result = await db.execute(
                select(func.coalesce(func.sum(Session.xp_awarded), 0)).where(
                    Session.student_id == student.id,
                    Session.ended_at.isnot(None),
                )
            )
            xp_in_module = xp_result.scalar_one() or 0

        weak_areas = await StudentService._get_weak_areas(db, student.id)

        return StudentProgress(
            xp_total=student.xp_total,
            current_module_id=student.current_module_id,
            current_module_title=module_title,
            xp_in_module=xp_in_module,
            xp_threshold=xp_threshold,
            weak_areas=weak_areas,
        )

    @staticmethod
    async def _get_weak_areas(db: AsyncSession, student_id: int) -> list[str]:
        """Return skills with avg score below 70 across last 10 sessions."""
        result = await db.execute(
            select(SkillScore.skill, func.avg(SkillScore.score).label("avg_score"))
            .join(Session, Session.id == SkillScore.session_id)
            .where(Session.student_id == student_id)
            .group_by(SkillScore.skill)
            .having(func.avg(SkillScore.score) < 70)
        )
        return [row.skill for row in result.all()]

    @staticmethod
    async def get_history(
        db: AsyncSession, student_id: int, limit: int = 20, offset: int = 0
    ) -> list[StudentHistory]:
        result = await db.execute(
            select(Session)
            .where(Session.student_id == student_id)
            .order_by(Session.started_at.desc())
            .offset(offset)
            .limit(limit)
        )
        sessions = result.scalars().all()
        return [StudentHistory.model_validate(s) for s in sessions]

    @staticmethod
    async def get_audit_log(
        db: AsyncSession, student_id: int
    ) -> list[AuditLogEntry]:
        result = await db.execute(
            select(LevelAuditLog)
            .where(LevelAuditLog.student_id == student_id)
            .order_by(LevelAuditLog.created_at.desc())
        )
        entries = result.scalars().all()

        # Resolve module titles in one batch
        module_ids = {e.from_module_id for e in entries} | {e.to_module_id for e in entries}
        titles: dict[int, str] = {}
        if module_ids:
            mod_result = await db.execute(
                select(Module.id, Module.title).where(Module.id.in_(module_ids))
            )
            titles = {row.id: row.title for row in mod_result.all()}

        return [
            AuditLogEntry(
                id=e.id,
                from_module_id=e.from_module_id,
                to_module_id=e.to_module_id,
                from_module_title=titles.get(e.from_module_id),
                to_module_title=titles.get(e.to_module_id),
                reason_text=e.reason_text,
                evidence_json=e.evidence_json,
                created_at=e.created_at,
            )
            for e in entries
        ]
