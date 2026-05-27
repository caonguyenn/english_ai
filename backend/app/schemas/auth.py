"""Auth-related Pydantic v2 schemas."""
from datetime import datetime

from pydantic import BaseModel, computed_field


class StudentProfile(BaseModel):
    id: int
    cognito_sub: str
    name: str | None
    email: str
    current_module_id: int | None
    placement_band: float | None
    xp_total: int
    placement_completed_at: datetime | None

    model_config = {"from_attributes": True}

    @computed_field  # type: ignore[misc]
    @property
    def placement_required(self) -> bool:
        return self.placement_completed_at is None


class ConfirmPlacementRequest(BaseModel):
    module_id: int
    placement_band: float


class RegisterRequest(BaseModel):
    """Not used as a body — registration reads from JWT claims.
    Kept for OpenAPI documentation purposes."""

    pass
