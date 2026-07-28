from typing import Any

from pydantic import BaseModel

from app.core.error_codes import ErrorCode


class ErrorBody(BaseModel):
    code: ErrorCode
    message: str
    details: dict[str, Any] | None = None


class ErrorEnvelope(BaseModel):
    error: ErrorBody
