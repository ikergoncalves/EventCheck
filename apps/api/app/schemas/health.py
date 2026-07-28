from enum import StrEnum

from pydantic import BaseModel


class HealthStatus(StrEnum):
    ok = "ok"
    degraded = "degraded"


class DatabaseStatus(StrEnum):
    up = "up"
    down = "down"


class Health(BaseModel):
    status: HealthStatus
    version: str
    uptime_seconds: int
    database: DatabaseStatus | None = None
