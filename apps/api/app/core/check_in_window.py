from datetime import datetime, timedelta
from typing import Protocol

CHECK_IN_OPENS_BEFORE_START_HOURS = 12
CHECK_IN_CLOSES_AFTER_END_HOURS = 2

_PUBLISHED = "published"
_FINISHED = "finished"


class WindowedEvent(Protocol):
    status: str
    starts_at: datetime
    ends_at: datetime


def is_within_check_in_window(event: WindowedEvent, now: datetime) -> bool:
    if event.status != _PUBLISHED:
        return False
    opens_at = event.starts_at - timedelta(hours=CHECK_IN_OPENS_BEFORE_START_HOURS)
    closes_at = event.ends_at + timedelta(hours=CHECK_IN_CLOSES_AFTER_END_HOURS)
    return opens_at <= now <= closes_at


def resolve_event_status(event: WindowedEvent, now: datetime) -> str:
    if event.status == _PUBLISHED:
        closes_at = event.ends_at + timedelta(hours=CHECK_IN_CLOSES_AFTER_END_HOURS)
        if now > closes_at:
            return _FINISHED
    return event.status
