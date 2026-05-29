"""Module and class listing routes."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_student, get_db
from app.db.models.student import Student
from app.schemas.module import ClassResponse, ModuleResponse, ModuleWithProgressResponse
from app.services.module_service import ModuleService

router = APIRouter(prefix="/modules", tags=["modules"])


@router.get("", response_model=list[ModuleWithProgressResponse])
async def list_modules(
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> list[ModuleWithProgressResponse]:
    return await ModuleService.list_modules(db, student_id=current.id)


@router.get("/{module_id}", response_model=ModuleResponse)
async def get_module(
    module_id: UUID,
    _: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> ModuleResponse:
    module = await ModuleService.get_module(db, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return ModuleResponse.model_validate(module)


@router.get("/{module_id}/classes", response_model=list[ClassResponse])
async def list_classes(
    module_id: UUID,
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> list[ClassResponse]:
    module = await ModuleService.get_module(db, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return await ModuleService.list_classes(db, module_id=module_id, student_id=current.id)
