from datetime import timedelta

import jwt
from httpx import AsyncClient

from tests.conftest import make_token


async def test_me_without_token_is_401(client: AsyncClient) -> None:
    response = await client.get("/api/v1/me")

    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "UNAUTHORIZED"
    assert "detail" not in body


async def test_me_with_expired_token_is_401(client: AsyncClient) -> None:
    token = make_token(expires_delta=timedelta(hours=-1))

    response = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


async def test_me_with_wrong_signing_key_is_401(
    client: AsyncClient, other_signer_private_key: object
) -> None:
    token = make_token(private_key=other_signer_private_key)  # type: ignore[arg-type]

    response = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


async def test_me_with_none_algorithm_is_401(client: AsyncClient) -> None:
    payload = {"sub": "00000000-0000-0000-0000-000000000000", "email": "x@example.com"}
    token = jwt.encode(payload, key=None, algorithm="none")

    response = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


async def test_me_with_hs256_algorithm_is_401(client: AsyncClient) -> None:
    payload = {"sub": "00000000-0000-0000-0000-000000000000", "email": "x@example.com"}
    token = jwt.encode(payload, key="some-shared-secret-at-least-32-bytes-long", algorithm="HS256")

    response = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


async def test_me_with_valid_token_upserts_organizer(client: AsyncClient) -> None:
    token = make_token(email="alice@example.com")

    response = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["email"] == "alice@example.com"
