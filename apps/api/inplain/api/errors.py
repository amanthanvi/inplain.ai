from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


@dataclass(frozen=True)
class ApiError(Exception):
    status_code: int
    code: str
    message: str
    details: dict[str, Any] | None = None


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def handle_api_error(_: Request, exc: ApiError) -> JSONResponse:
        return _error(
            status_code=exc.status_code,
            code=exc.code,
            message=exc.message,
            details=exc.details,
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail
        if isinstance(detail, dict) and "error" in detail:
            return JSONResponse(status_code=exc.status_code, content=detail)

        code = _default_code(exc.status_code)
        message = str(detail) if detail else code
        return _error(status_code=exc.status_code, code=code, message=message)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return _error(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Invalid request",
            details={"errors": exc.errors()},
        )

    @app.exception_handler(Exception)
    async def handle_unhandled(_: Request, __: Exception) -> JSONResponse:
        return _error(status_code=500, code="INTERNAL_ERROR", message="Internal server error")


def _error(
    *, status_code: int, code: str, message: str, details: dict[str, Any] | None = None
) -> JSONResponse:
    payload: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        payload["details"] = details
    return JSONResponse(status_code=status_code, content={"error": payload})


def _default_code(status_code: int) -> str:
    match status_code:
        case 400:
            return "BAD_REQUEST"
        case 401:
            return "UNAUTHORIZED"
        case 403:
            return "FORBIDDEN"
        case 404:
            return "NOT_FOUND"
        case 409:
            return "CONFLICT"
        case 422:
            return "VALIDATION_ERROR"
        case _:
            return "ERROR"
