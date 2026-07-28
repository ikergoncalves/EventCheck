import math
import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.check_in_window import CHECK_IN_CLOSES_AFTER_END_HOURS
from app.core.error_codes import ErrorCode
from app.core.errors import ConflictError, NotFoundError, ValidationAppError
from app.models import Event, Ticket
from app.schemas.event import Event as EventSchema
from app.schemas.event import EventCreate, EventStatus, EventUpdate
from app.schemas.page import Page

_CLOSES_AFTER = text(f"interval '{CHECK_IN_CLOSES_AFTER_END_HOURS} hours'")

_SORT_COLUMNS = {
    "starts_at": Event.starts_at.asc(),
    "-starts_at": Event.starts_at.desc(),
    "created_at": Event.created_at.asc(),
    "-created_at": Event.created_at.desc(),
}


async def _promote_finished_events(db: AsyncSession, organizer_id: uuid.UUID) -> None:
    """Lazily close out published events whose check-in window is over.

    Runs as a single UPDATE, scoped by organizer and covered by the
    events(status, ends_at) index, before any read or write that touches
    this organizer's events — there is no scheduler in this project.
    """
    await db.execute(
        update(Event)
        .where(
            Event.organizer_id == organizer_id,
            Event.status == EventStatus.published.value,
            Event.ends_at < (func.now() - _CLOSES_AFTER),
        )
        .values(status=EventStatus.finished.value, updated_at=func.now())
    )


async def _get_event_row(db: AsyncSession, organizer_id: uuid.UUID, event_id: uuid.UUID) -> Event:
    stmt = select(Event).where(Event.id == event_id, Event.organizer_id == organizer_id)
    event = (await db.execute(stmt)).scalar_one_or_none()
    if event is None:
        raise NotFoundError("Event not found.", code=ErrorCode.EVENT_NOT_FOUND)
    return event


async def _get_counts(db: AsyncSession, event_id: uuid.UUID) -> tuple[int, int]:
    stmt = select(
        func.count(Ticket.id).filter(Ticket.status != "revoked"),
        func.count(Ticket.id).filter(Ticket.status == "checked_in"),
    ).where(Ticket.event_id == event_id)
    tickets_issued, checked_in_count = (await db.execute(stmt)).one()
    return tickets_issued, checked_in_count


def _to_schema(event: Event, counts: tuple[int, int]) -> EventSchema:
    tickets_issued, checked_in_count = counts
    return EventSchema(
        id=event.id,
        organizer_id=event.organizer_id,
        title=event.title,
        description=event.description,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        timezone=event.timezone,
        venue_name=event.venue_name,
        address=event.address,
        capacity=event.capacity,
        status=EventStatus(event.status),
        tickets_issued=tickets_issued,
        checked_in_count=checked_in_count,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )


async def list_events(
    db: AsyncSession,
    organizer_id: uuid.UUID,
    *,
    statuses: list[EventStatus] | None,
    search: str | None,
    page: int,
    page_size: int,
    sort: str,
) -> Page[EventSchema]:
    await _promote_finished_events(db, organizer_id)

    filters = [Event.organizer_id == organizer_id]
    if statuses:
        filters.append(Event.status.in_([status.value for status in statuses]))
    if search:
        filters.append(Event.title.ilike(f"%{search}%"))

    total = (await db.execute(select(func.count()).select_from(Event).where(*filters))).scalar_one()

    tickets_issued = func.count(Ticket.id).filter(Ticket.status != "revoked")
    checked_in_count = func.count(Ticket.id).filter(Ticket.status == "checked_in")
    stmt = (
        select(Event, tickets_issued, checked_in_count)
        .outerjoin(Ticket, Ticket.event_id == Event.id)
        .where(*filters)
        .group_by(Event.id)
        .order_by(_SORT_COLUMNS[sort])
        .limit(page_size)
        .offset((page - 1) * page_size)
    )
    rows = (await db.execute(stmt)).all()
    await db.commit()

    items = [_to_schema(event, (issued, checked_in)) for event, issued, checked_in in rows]
    total_pages = math.ceil(total / page_size) if total else 0
    return Page[EventSchema](
        page=page, page_size=page_size, total=total, total_pages=total_pages, items=items
    )


async def create_event(
    db: AsyncSession, organizer_id: uuid.UUID, payload: EventCreate
) -> EventSchema:
    event = Event(
        organizer_id=organizer_id,
        title=payload.title,
        description=payload.description,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        timezone=payload.timezone,
        venue_name=payload.venue_name,
        address=payload.address,
        capacity=payload.capacity,
        status=EventStatus.draft.value,
    )
    db.add(event)
    await db.flush()
    await db.refresh(event)
    await db.commit()
    return _to_schema(event, (0, 0))


async def get_event(db: AsyncSession, organizer_id: uuid.UUID, event_id: uuid.UUID) -> EventSchema:
    await _promote_finished_events(db, organizer_id)
    event = await _get_event_row(db, organizer_id, event_id)
    counts = await _get_counts(db, event.id)
    await db.commit()
    return _to_schema(event, counts)


async def update_event(
    db: AsyncSession, organizer_id: uuid.UUID, event_id: uuid.UUID, payload: EventUpdate
) -> EventSchema:
    now = datetime.now(UTC)
    await _promote_finished_events(db, organizer_id)
    event = await _get_event_row(db, organizer_id, event_id)

    if event.status in (EventStatus.finished.value, EventStatus.cancelled.value):
        raise ConflictError("This event can no longer be modified.", code=ErrorCode.EVENT_IMMUTABLE)

    data = payload.model_dump(exclude_unset=True)
    effective_starts_at = data.get("starts_at", event.starts_at)
    effective_ends_at = data.get("ends_at", event.ends_at)

    if effective_ends_at <= effective_starts_at:
        raise ValidationAppError("ends_at", "must be after starts_at")

    if (
        event.status == EventStatus.published.value
        and "ends_at" in data
        and effective_ends_at < now
    ):
        raise ValidationAppError(
            "ends_at", "cannot move ends_at into the past for a published event"
        )

    for field, value in data.items():
        setattr(event, field, value)
    event.updated_at = now

    await db.flush()
    counts = await _get_counts(db, event.id)
    await db.commit()
    return _to_schema(event, counts)


async def delete_event(db: AsyncSession, organizer_id: uuid.UUID, event_id: uuid.UUID) -> None:
    now = datetime.now(UTC)
    await _promote_finished_events(db, organizer_id)
    event = await _get_event_row(db, organizer_id, event_id)

    if event.status in (EventStatus.finished.value, EventStatus.cancelled.value):
        raise ConflictError("This event can no longer be modified.", code=ErrorCode.EVENT_IMMUTABLE)

    event.status = EventStatus.cancelled.value
    event.updated_at = now
    await db.execute(
        update(Ticket)
        .where(Ticket.event_id == event_id, Ticket.status == "valid")
        .values(status="revoked")
    )
    await db.commit()


async def publish_event(
    db: AsyncSession, organizer_id: uuid.UUID, event_id: uuid.UUID
) -> EventSchema:
    now = datetime.now(UTC)
    await _promote_finished_events(db, organizer_id)
    event = await _get_event_row(db, organizer_id, event_id)

    if event.status != EventStatus.draft.value:
        raise ConflictError("Only draft events can be published.", code=ErrorCode.EVENT_IMMUTABLE)
    if event.starts_at <= now:
        raise ConflictError(
            "starts_at must be in the future to publish.", code=ErrorCode.EVENT_NOT_ACTIVE
        )

    event.status = EventStatus.published.value
    event.updated_at = now
    await db.flush()
    counts = await _get_counts(db, event.id)
    await db.commit()
    return _to_schema(event, counts)
