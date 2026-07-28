import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.error_codes import ErrorCode

logger = logging.getLogger("eventcheck")


class AppError(Exception):
    status_code: int = status.HTTP_400_BAD_REQUEST
    code: ErrorCode = ErrorCode.INTERNAL_ERROR

    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details


class UnauthorizedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = ErrorCode.UNAUTHORIZED


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND

    def __init__(
        self, message: str, *, code: ErrorCode, details: dict[str, Any] | None = None
    ) -> None:
        super().__init__(message, details=details)
        self.code = code


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT

    def __init__(
        self, message: str, *, code: ErrorCode, details: dict[str, Any] | None = None
    ) -> None:
        super().__init__(message, details=details)
        self.code = code


class ValidationAppError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    code = ErrorCode.VALIDATION_ERROR

    def __init__(self, field: str, message: str) -> None:
        super().__init__(
            "Request body is invalid.",
            details={"fields": [{"field": field, "message": message}]},
        )


def _envelope(
    code: ErrorCode, message: str, details: dict[str, Any] | None = None
) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code.value, "message": message}
    if details is not None:
        error["details"] = details
    return {"error": error}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        fields = [
            {"field": ".".join(str(part) for part in error["loc"][1:]), "message": error["msg"]}
            for error in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content=_envelope(
                ErrorCode.VALIDATION_ERROR,
                "Request body is invalid.",
                {"fields": fields},
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        # Covers cases FastAPI itself raises outside our domain model (unmatched
        # routes, method not allowed): the default {"detail": ...} body must
        # never leak, even here.
        code = ErrorCode.UNAUTHORIZED if exc.status_code == 401 else ErrorCode.INTERNAL_ERROR
        message = exc.detail if isinstance(exc.detail, str) else "An unexpected error occurred."
        return JSONResponse(status_code=exc.status_code, content=_envelope(code, message))

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception", exc_info=exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_envelope(ErrorCode.INTERNAL_ERROR, "An unexpected error occurred."),
        )
