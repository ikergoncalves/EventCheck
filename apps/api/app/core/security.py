import logging
import uuid

import anyio
import jwt
from fastapi import Depends, Request
from jwt import PyJWKClient
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.errors import UnauthorizedError
from app.db.session import get_db
from app.models import Organizer

logger = logging.getLogger("eventcheck.security")

_jwks_client: PyJWKClient | None = None


def get_jwks_client(settings: Settings | None = None) -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        settings = settings or get_settings()
        _jwks_client = PyJWKClient(
            settings.supabase_jwks_url,
            cache_keys=True,
            lifespan=settings.supabase_jwks_cache_seconds,
        )
    return _jwks_client


async def warm_jwks_cache() -> None:
    """Populate the JWKS cache at startup so the first request never pays the
    fetch cost, and a transient Supabase outage at boot doesn't take the
    request path down with it."""
    client = get_jwks_client()
    try:
        await anyio.to_thread.run_sync(client.get_jwk_set)
    except Exception:
        logger.warning("Could not warm the Supabase JWKS cache at startup", exc_info=True)


def _extract_bearer_token(request: Request) -> str:
    header = request.headers.get("authorization")
    if not header or not header.lower().startswith("bearer "):
        raise UnauthorizedError("Missing or invalid credentials.")
    return header.split(" ", 1)[1].strip()


async def get_current_organizer(request: Request, db: AsyncSession = Depends(get_db)) -> Organizer:
    settings = get_settings()
    token = _extract_bearer_token(request)
    client = get_jwks_client(settings)

    try:
        # PyJWKClient does blocking HTTP under the hood on a cache miss; keep it
        # off the event loop so one slow lookup doesn't stall every request.
        signing_key = await anyio.to_thread.run_sync(client.get_signing_key_from_jwt, token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience=settings.supabase_jwt_audience,
            issuer=settings.supabase_issuer,
        )
        sub = claims["sub"]
        email = claims["email"]
        organizer_id = uuid.UUID(sub)
    except Exception as exc:
        logger.info("JWT validation failed", exc_info=exc)
        raise UnauthorizedError("Missing or invalid credentials.") from None

    stmt = (
        insert(Organizer)
        .values(id=organizer_id, email=email)
        .on_conflict_do_update(index_elements=[Organizer.id], set_={"email": email})
        .returning(Organizer)
    )
    result = await db.execute(stmt)
    organizer = result.scalar_one()
    await db.commit()
    return organizer
