import uuid
from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Event
from tests.conftest import make_token


def _event_payload(**overrides: object) -> dict:
    now = datetime.now(UTC)
    payload = {
        "title": "Conference 2026",
        "starts_at": (now + timedelta(days=10)).isoformat(),
        "ends_at": (now + timedelta(days=10, hours=3)).isoformat(),
        "timezone": "America/Sao_Paulo",
        "capacity": 100,
    }
    payload.update(overrides)
    return payload


async def _headers_for(client: AsyncClient, organizer_id: uuid.UUID) -> dict[str, str]:
    token = make_token(sub=str(organizer_id))
    headers = {"Authorization": f"Bearer {token}"}
    await client.get("/api/v1/me", headers=headers)  # ensures the organizer row exists
    return headers


async def test_create_and_list_event(client: AsyncClient, organizer_id: uuid.UUID) -> None:
    headers = await _headers_for(client, organizer_id)

    create_response = await client.post("/api/v1/events", json=_event_payload(), headers=headers)
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["status"] == "draft"
    assert created["tickets_issued"] == 0
    assert created["checked_in_count"] == 0
    assert "Location" in create_response.headers

    list_response = await client.get("/api/v1/events", headers=headers)
    assert list_response.status_code == 200
    body = list_response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == created["id"]


async def test_organizer_isolation_returns_404(
    client: AsyncClient, organizer_id: uuid.UUID
) -> None:
    headers_a = await _headers_for(client, organizer_id)
    create_response = await client.post("/api/v1/events", json=_event_payload(), headers=headers_a)
    event_id = create_response.json()["id"]

    headers_b = await _headers_for(client, uuid.uuid4())
    get_response = await client.get(f"/api/v1/events/{event_id}", headers=headers_b)

    assert get_response.status_code == 404
    assert get_response.json()["error"]["code"] == "EVENT_NOT_FOUND"


async def test_ends_at_before_starts_at_is_422(
    client: AsyncClient, organizer_id: uuid.UUID
) -> None:
    headers = await _headers_for(client, organizer_id)
    now = datetime.now(UTC)
    payload = _event_payload(
        starts_at=(now + timedelta(days=5)).isoformat(),
        ends_at=(now + timedelta(days=4)).isoformat(),
    )

    response = await client.post("/api/v1/events", json=payload, headers=headers)

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["details"]["fields"][0]["field"] == "ends_at"


async def test_publish_with_past_starts_at_is_409(
    client: AsyncClient, organizer_id: uuid.UUID
) -> None:
    headers = await _headers_for(client, organizer_id)
    now = datetime.now(UTC)
    payload = _event_payload(
        starts_at=(now - timedelta(days=2)).isoformat(),
        ends_at=(now - timedelta(days=1)).isoformat(),
    )
    create_response = await client.post("/api/v1/events", json=payload, headers=headers)
    event_id = create_response.json()["id"]

    response = await client.post(f"/api/v1/events/{event_id}/publish", headers=headers)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "EVENT_IMMUTABLE"


async def test_lazy_transition_marks_published_event_finished(
    client: AsyncClient, organizer_id: uuid.UUID, db_session: AsyncSession
) -> None:
    headers = await _headers_for(client, organizer_id)
    now = datetime.now(UTC)
    event = Event(
        organizer_id=organizer_id,
        title="Past event",
        starts_at=now - timedelta(days=1),
        ends_at=now - timedelta(hours=3),  # more than 2h ago -> window closed
        timezone="America/Sao_Paulo",
        capacity=10,
        status="published",
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)

    response = await client.get(f"/api/v1/events/{event.id}", headers=headers)

    assert response.status_code == 200
    assert response.json()["status"] == "finished"


async def test_delete_on_finished_event_is_409(
    client: AsyncClient, organizer_id: uuid.UUID, db_session: AsyncSession
) -> None:
    headers = await _headers_for(client, organizer_id)
    now = datetime.now(UTC)
    event = Event(
        organizer_id=organizer_id,
        title="Already finished",
        starts_at=now - timedelta(days=1),
        ends_at=now - timedelta(hours=3),
        timezone="America/Sao_Paulo",
        capacity=10,
        status="published",
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)

    response = await client.delete(f"/api/v1/events/{event.id}", headers=headers)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "EVENT_IMMUTABLE"


async def test_patch_moving_ends_at_to_past_on_published_event_is_422(
    client: AsyncClient, organizer_id: uuid.UUID
) -> None:
    headers = await _headers_for(client, organizer_id)
    now = datetime.now(UTC)
    payload = _event_payload(
        starts_at=(now + timedelta(hours=1)).isoformat(),
        ends_at=(now + timedelta(hours=3)).isoformat(),
    )
    create_response = await client.post("/api/v1/events", json=payload, headers=headers)
    event_id = create_response.json()["id"]
    publish_response = await client.post(f"/api/v1/events/{event_id}/publish", headers=headers)
    assert publish_response.status_code == 200

    patch_response = await client.patch(
        f"/api/v1/events/{event_id}",
        json={"ends_at": (now - timedelta(hours=1)).isoformat()},
        headers=headers,
    )

    assert patch_response.status_code == 422
    body = patch_response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["details"]["fields"][0]["field"] == "ends_at"
