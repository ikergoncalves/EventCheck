import asyncio
import time

from fastapi import APIRouter, Request
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.db.session import async_session_factory
from app.schemas.health import DatabaseStatus, Health, HealthStatus

router = APIRouter(tags=["system"])


@router.get("/health", response_model=Health)
async def get_health(request: Request) -> Health:
    settings = get_settings()
    database_status = DatabaseStatus.up
    try:
        async with async_session_factory() as session:
            await asyncio.wait_for(session.execute(text("SELECT 1")), timeout=2.0)
    except (SQLAlchemyError, TimeoutError, OSError):
        database_status = DatabaseStatus.down

    uptime_seconds = int(time.monotonic() - request.app.state.start_time)
    overall_status = (
        HealthStatus.ok if database_status == DatabaseStatus.up else HealthStatus.degraded
    )
    return Health(
        status=overall_status,
        version=settings.app_version,
        uptime_seconds=uptime_seconds,
        database=database_status,
    )
