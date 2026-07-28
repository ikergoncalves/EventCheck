import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.endpoints import health
from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.core.security import warm_jwks_cache


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    settings = get_settings()
    configure_logging(settings.environment)
    await warm_jwks_cache()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="EventCheck API", version=settings.app_version, lifespan=lifespan)
    # Set outside the lifespan too: httpx's ASGITransport doesn't run startup
    # events unless a lifespan manager is wired in explicitly, and /health
    # must not depend on that.
    app.state.start_time = time.monotonic()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(health.router)
    app.include_router(api_router)
    return app


app = create_app()
