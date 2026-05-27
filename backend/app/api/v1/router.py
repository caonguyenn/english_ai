"""Aggregate all v1 route handlers into a single router."""
from fastapi import APIRouter

from app.api.v1.routes import admin, auth, modules, playground, sessions, students

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(students.router)
api_router.include_router(sessions.router)
api_router.include_router(modules.router)
api_router.include_router(playground.router)
api_router.include_router(admin.router)
