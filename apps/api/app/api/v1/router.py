from fastapi import APIRouter

from app.api.v1.endpoints import events, me

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(me.router)
api_router.include_router(events.router)
