import asyncio
import json
import uuid
from collections.abc import AsyncGenerator, Generator
from datetime import UTC, datetime, timedelta

import jwt
import pytest
import pytest_asyncio
from cryptography.hazmat.primitives.asymmetric import ec
from httpx import ASGITransport, AsyncClient
from jwt.algorithms import ECAlgorithm
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app

_PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1())
_PUBLIC_KEY = _PRIVATE_KEY.public_key()
_KID = "test-key-1"
_OTHER_PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1())  # wrong-signer fixture

_JWK = json.loads(ECAlgorithm.to_jwk(_PUBLIC_KEY))
_JWK.update(kid=_KID, use="sig", alg="ES256")
_FAKE_JWKS = {"keys": [_JWK]}

_SETTINGS = get_settings()
TEST_DATABASE_URL = str(_SETTINGS.test_database_url)


@pytest.fixture(scope="session", autouse=True)
def _patch_jwks_fetch() -> Generator[None]:
    mp = pytest.MonkeyPatch()
    mp.setattr(jwt.PyJWKClient, "fetch_data", lambda self: _FAKE_JWKS)
    yield
    mp.undo()


@pytest.fixture(scope="session", autouse=True)
def _create_schema() -> None:
    async def _create() -> None:
        engine = create_async_engine(TEST_DATABASE_URL)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        await engine.dispose()

    asyncio.run(_create())


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession]:
    engine: AsyncEngine = create_async_engine(TEST_DATABASE_URL)
    connection = await engine.connect()
    trans = await connection.begin()

    session_factory = async_sessionmaker(
        bind=connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    session = session_factory()

    try:
        yield session
    finally:
        await session.close()
        await trans.rollback()
        await connection.close()
        await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient]:
    async def _override_get_db() -> AsyncGenerator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.clear()


def make_token(
    *,
    sub: str | None = None,
    email: str = "organizer@example.com",
    private_key: ec.EllipticCurvePrivateKey = _PRIVATE_KEY,
    kid: str = _KID,
    algorithm: str = "ES256",
    audience: str = "authenticated",
    issuer: str | None = None,
    expires_delta: timedelta = timedelta(hours=1),
) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": sub or str(uuid.uuid4()),
        "email": email,
        "aud": audience,
        "iss": issuer or _SETTINGS.supabase_issuer,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, private_key, algorithm=algorithm, headers={"kid": kid})


@pytest.fixture
def other_signer_private_key() -> ec.EllipticCurvePrivateKey:
    return _OTHER_PRIVATE_KEY


@pytest.fixture
def organizer_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def auth_headers(organizer_id: uuid.UUID) -> dict[str, str]:
    token = make_token(sub=str(organizer_id))
    return {"Authorization": f"Bearer {token}"}
