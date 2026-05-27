"""Session business logic — create, end, XP cap, skill scores."""
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.module import Module
from app.db.models.session import Session, SessionType, SkillScore
from app.db.models.student import Student
from app.schemas.session import SessionCreate, SessionPatch, SkillScoreCreate


class SessionService:
    @staticmethod
    async def create(db: AsyncSession, student_id: int, data: SessionCreate) -> Session:
        session = Session(
            student_id=student_id,
            class_id=data.class_id,
            topic_id=data.topic_id,
            session_type=SessionType(data.session_type),
            started_at=datetime.now(tz=timezone.utc),
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session

    @staticmethod
    async def get(db: AsyncSession, session_id: int) -> Session | None:
        return await db.get(Session, session_id)

    @staticmethod
    async def end_session(
        db: AsyncSession, session: Session, data: SessionPatch
    ) -> Session:
        if data.ended_at is not None:
            session.ended_at = data.ended_at
        if data.transcript_json is not None:
            session.transcript_json = data.transcript_json
        if data.summary_json is not None:
            session.summary_json = data.summary_json

        if data.xp_awarded is not None:
            xp_to_award = data.xp_awarded
            if session.session_type == SessionType.playground:
                xp_to_award = await SessionService._apply_playground_xp_cap(
                    db, session.student_id, xp_to_award
                )
            session.xp_awarded = xp_to_award

            # Update student total XP
            student = await db.execute(
                select(Student)
                .where(Student.id == session.student_id)
                .with_for_update()
            )
            student_row = student.scalar_one_or_none()
            if student_row:
                student_row.xp_total = (student_row.xp_total or 0) + xp_to_award

        await db.commit()
        await db.refresh(session)
        return session

    @staticmethod
    async def _apply_playground_xp_cap(
        db: AsyncSession, student_id: int, requested_xp: int
    ) -> int:
        """Cap playground XP against daily limit. Caller holds FOR UPDATE lock on student row.

        Red Team Fix #8: student row must be locked with SELECT FOR UPDATE before this is called
        (done in end_session above) to prevent concurrent over-awarding.
        """
        # Get student's current module to find threshold
        student_result = await db.execute(
            select(Student).where(Student.id == student_id)
        )
        student = student_result.scalar_one_or_none()
        if not student or student.current_module_id is None:
            # Pre-placement: no playground XP
            return 0

        module = await db.get(Module, student.current_module_id)
        if not module:
            return 0

        daily_cap = int(module.xp_threshold * settings.PLAYGROUND_XP_DAILY_CAP_PCT / 100)

        # Sum playground XP awarded today
        today_start = datetime.now(tz=timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        result = await db.execute(
            select(func.coalesce(func.sum(Session.xp_awarded), 0)).where(
                Session.student_id == student_id,
                Session.session_type == SessionType.playground,
                Session.ended_at >= today_start,
            )
        )
        xp_today = result.scalar_one() or 0

        remaining = max(0, daily_cap - xp_today)
        return min(requested_xp, remaining)

    @staticmethod
    async def add_skill_score(
        db: AsyncSession, session_id: int, data: SkillScoreCreate
    ) -> SkillScore:
        score = SkillScore(
            session_id=session_id,
            skill=data.skill,
            score=data.score,
            notes=data.notes,
            recorded_at=datetime.now(tz=timezone.utc),
        )
        db.add(score)
        await db.commit()
        await db.refresh(score)
        return score
