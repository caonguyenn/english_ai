"""Module and Class Pydantic v2 schemas."""
from pydantic import BaseModel


class ModuleResponse(BaseModel):
    id: int
    band_min: float
    band_max: float
    title: str
    description: str | None
    xp_threshold: int
    order_index: int

    model_config = {"from_attributes": True}


class ModuleWithProgressResponse(ModuleResponse):
    """Module response with student enrollment progress overlay."""
    xp_earned: int = 0
    enrolled: bool = False


class ClassResponse(BaseModel):
    id: int
    module_id: int
    title: str
    skill_type: str
    description: str | None
    xp_reward: int
    order_index: int
    completed: bool = False

    model_config = {"from_attributes": True}


class PlaygroundTopicResponse(BaseModel):
    id: int
    slug: str
    title: str
    description: str | None
    difficulty_band: float | None

    model_config = {"from_attributes": True}
