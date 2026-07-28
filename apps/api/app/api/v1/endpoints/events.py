import uuid
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentOrganizer, DbSession
from app.schemas.error import ErrorEnvelope
from app.schemas.event import Event, EventCreate, EventStatus, EventUpdate
from app.schemas.page import Page
from app.services import events as events_service

router = APIRouter(prefix="/events", tags=["events"])

_UNAUTHORIZED: dict[int | str, dict[str, Any]] = {401: {"model": ErrorEnvelope}}
_NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"model": ErrorEnvelope}}
_CONFLICT: dict[int | str, dict[str, Any]] = {409: {"model": ErrorEnvelope}}
_VALIDATION: dict[int | str, dict[str, Any]] = {422: {"model": ErrorEnvelope}}


@router.get("", response_model=Page[Event], responses={**_UNAUTHORIZED, **_VALIDATION})
async def list_events(
    db: DbSession,
    organizer: CurrentOrganizer,
    status_filter: Annotated[list[EventStatus] | None, Query(alias="status")] = None,
    search: Annotated[str | None, Query(max_length=120)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    sort: Annotated[
        Literal["starts_at", "-starts_at", "created_at", "-created_at"], Query()
    ] = "-starts_at",
) -> Page[Event]:
    return await events_service.list_events(
        db,
        organizer.id,
        statuses=status_filter,
        search=search,
        page=page,
        page_size=page_size,
        sort=sort,
    )


@router.post(
    "",
    response_model=Event,
    status_code=status.HTTP_201_CREATED,
    responses={**_UNAUTHORIZED, **_VALIDATION},
)
async def create_event(
    db: DbSession, organizer: CurrentOrganizer, payload: EventCreate, response: Response
) -> Event:
    event = await events_service.create_event(db, organizer.id, payload)
    response.headers["Location"] = f"/api/v1/events/{event.id}"
    return event


@router.get(
    "/{event_id}",
    response_model=Event,
    responses={**_UNAUTHORIZED, **_NOT_FOUND, **_VALIDATION},
)
async def get_event(db: DbSession, organizer: CurrentOrganizer, event_id: uuid.UUID) -> Event:
    return await events_service.get_event(db, organizer.id, event_id)


@router.patch(
    "/{event_id}",
    response_model=Event,
    responses={**_UNAUTHORIZED, **_NOT_FOUND, **_CONFLICT, **_VALIDATION},
)
async def update_event(
    db: DbSession, organizer: CurrentOrganizer, event_id: uuid.UUID, payload: EventUpdate
) -> Event:
    return await events_service.update_event(db, organizer.id, event_id, payload)


@router.delete(
    "/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**_UNAUTHORIZED, **_NOT_FOUND, **_CONFLICT, **_VALIDATION},
)
async def delete_event(db: DbSession, organizer: CurrentOrganizer, event_id: uuid.UUID) -> None:
    await events_service.delete_event(db, organizer.id, event_id)


@router.post(
    "/{event_id}/publish",
    response_model=Event,
    responses={**_UNAUTHORIZED, **_NOT_FOUND, **_CONFLICT, **_VALIDATION},
)
async def publish_event(db: DbSession, organizer: CurrentOrganizer, event_id: uuid.UUID) -> Event:
    return await events_service.publish_event(db, organizer.id, event_id)
