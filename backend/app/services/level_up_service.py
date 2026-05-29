"""Level-up validation and execution — two-stage model per spec."""
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.level_audit import LevelAuditLog
from app.db.models.module import Class, Module
from app.db.models.session import Session, SkillScore
from app.db.models.student import Student


class LevelUpService:
    @staticmethod
    async def handle_placement(
        db: AsyncSession,
        student: Student,
        session_id: UUID | None,
        reason: str,
        evidence: dict,
    ) -> dict:
        """Assign initial module after placement assessment.

        No session count / score checks — placement is the very first session.
        Selects the module whose band range contains placement_band.
        """
        placement_band: float = float(evidence.get("placement_band", 3.0))
        placement_band = max(2.0, min(9.0, placement_band))

        # Find the module whose band range contains this score
        result = await db.execute(
            select(Module)
            .where(Module.band_min <= placement_band, Module.band_max > placement_band)
            .order_by(Module.band_min.asc())
            .limit(1)
        )
        module = result.scalar_one_or_none()

        # Fall back to lowest module if nothing matched
        if module is None:
            fallback = await db.execute(select(Module).order_by(Module.band_min.asc()).limit(1))
            module = fallback.scalar_one_or_none()

        if module is None:
            return {"approved": False, "reason": "No modules found in database", "new_module_id": None}

        from_module_id = student.current_module_id
        student.current_module_id = module.id
        student.placement_band = placement_band

        audit = LevelAuditLog(
            student_id=student.id,
            from_module_id=from_module_id,
            to_module_id=module.id,
            session_id=session_id,
            reason_text=reason,
            evidence_json=evidence,
        )
        db.add(audit)
        await db.commit()

        return {
            "approved": True,
            "reason": reason,
            "new_module_id": module.id,
            "from_module": "",
            "to_module": module.title,
            "new_band": placement_band,
        }

    @staticmethod
    async def validate_and_execute(
        db: AsyncSession,
        student: Student,
        session_id: UUID | None,
        reason: str,
        evidence: dict,
    ) -> dict:
        """Validate level-up conditions and promote student if approved.

        Checks (in order):
        1. student has a current module assigned
        2. >= LEVELUP_MIN_SESSIONS class sessions completed in current module
        3. avg skill score >= LEVELUP_MIN_AVG_SCORE across last N sessions
        4. no level-up in last LEVELUP_COOLDOWN_HOURS (entire log, not just current module)

        Returns: {"approved": bool, "reason": str, "new_module_id": UUID | None}
        """
        if student.current_module_id is None:
            return {"approved": False, "reason": "No module assigned", "new_module_id": None}

        # --- Check 1: minimum sessions ---
        class_ids_result = await db.execute(
            select(Class.id).where(Class.module_id == student.current_module_id)
        )
        class_ids = [row[0] for row in class_ids_result.all()]

        if not class_ids:
            return {
                "approved": False,
                "reason": "No classes in current module",
                "new_module_id": None,
            }

        count_result = await db.execute(
            select(func.count(Session.id)).where(
                Session.student_id == student.id,
                Session.class_id.in_(class_ids),
                Session.ended_at.isnot(None),
            )
        )
        session_count = count_result.scalar_one() or 0
        if session_count < settings.LEVELUP_MIN_SESSIONS:
            return {
                "approved": False,
                "reason": (
                    f"Need {settings.LEVELUP_MIN_SESSIONS} completed sessions, "
                    f"have {session_count}"
                ),
                "new_module_id": None,
            }

        # --- Check 2: average skill score ---
        avg_result = await db.execute(
            select(func.avg(SkillScore.score)).where(
                SkillScore.session_id.in_(
                    select(Session.id).where(
                        Session.student_id == student.id,
                        Session.class_id.in_(class_ids),
                        Session.ended_at.isnot(None),
                    )
                )
            )
        )
        avg_score = avg_result.scalar_one()
        if avg_score is None or avg_score < settings.LEVELUP_MIN_AVG_SCORE:
            actual = round(avg_score, 1) if avg_score is not None else 0
            return {
                "approved": False,
                "reason": (
                    f"Avg score {actual} below required {settings.LEVELUP_MIN_AVG_SCORE}"
                ),
                "new_module_id": None,
            }

        # --- Check 3: cooldown across ENTIRE level_audit_log ---
        cooldown_cutoff = datetime.now(tz=timezone.utc) - timedelta(
            hours=settings.LEVELUP_COOLDOWN_HOURS
        )
        recent_result = await db.execute(
            select(LevelAuditLog.created_at)
            .where(LevelAuditLog.student_id == student.id)
            .order_by(LevelAuditLog.created_at.desc())
            .limit(1)
        )
        last_levelup_at = recent_result.scalar_one_or_none()
        if last_levelup_at is not None:
            # Ensure timezone-aware comparison
            if last_levelup_at.tzinfo is None:
                last_levelup_at = last_levelup_at.replace(tzinfo=timezone.utc)
            if last_levelup_at > cooldown_cutoff:
                hours_remaining = (
                    last_levelup_at - cooldown_cutoff
                ).total_seconds() / 3600
                return {
                    "approved": False,
                    "reason": (
                        f"Cooldown active — {hours_remaining:.1f}h remaining"
                    ),
                    "new_module_id": None,
                }

        # --- All checks passed — find next module and promote ---
        current_module = await db.get(Module, student.current_module_id)
        next_module_result = await db.execute(
            select(Module)
            .where(Module.order_index > current_module.order_index)
            .order_by(Module.order_index.asc())
            .limit(1)
        )
        next_module = next_module_result.scalar_one_or_none()

        audit = LevelAuditLog(
            student_id=student.id,
            from_module_id=student.current_module_id,
            to_module_id=next_module.id if next_module else student.current_module_id,
            session_id=session_id,
            reason_text=reason,
            evidence_json=evidence,
        )
        db.add(audit)

        if next_module:
            student.current_module_id = next_module.id

        await db.commit()

        return {
            "approved": True,
            "reason": reason,
            "new_module_id": next_module.id if next_module else None,
        }
