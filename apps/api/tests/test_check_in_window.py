from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.core.check_in_window import (
    CHECK_IN_CLOSES_AFTER_END_HOURS,
    CHECK_IN_OPENS_BEFORE_START_HOURS,
    is_within_check_in_window,
    resolve_event_status,
)


@dataclass
class FakeEvent:
    status: str
    starts_at: datetime
    ends_at: datetime


STARTS_AT = datetime(2026, 8, 14, 19, 0, tzinfo=UTC)
ENDS_AT = datetime(2026, 8, 14, 22, 0, tzinfo=UTC)


def _event(status: str = "published") -> FakeEvent:
    return FakeEvent(status=status, starts_at=STARTS_AT, ends_at=ENDS_AT)


def test_window_opens_exactly_at_lower_bound() -> None:
    now = STARTS_AT - timedelta(hours=CHECK_IN_OPENS_BEFORE_START_HOURS)
    assert is_within_check_in_window(_event(), now) is True


def test_window_closed_one_minute_before_lower_bound() -> None:
    now = STARTS_AT - timedelta(hours=CHECK_IN_OPENS_BEFORE_START_HOURS, minutes=1)
    assert is_within_check_in_window(_event(), now) is False


def test_window_open_one_minute_after_lower_bound() -> None:
    now = STARTS_AT - timedelta(hours=CHECK_IN_OPENS_BEFORE_START_HOURS) + timedelta(minutes=1)
    assert is_within_check_in_window(_event(), now) is True


def test_window_open_exactly_at_upper_bound() -> None:
    now = ENDS_AT + timedelta(hours=CHECK_IN_CLOSES_AFTER_END_HOURS)
    assert is_within_check_in_window(_event(), now) is True


def test_window_closed_one_minute_after_upper_bound() -> None:
    now = ENDS_AT + timedelta(hours=CHECK_IN_CLOSES_AFTER_END_HOURS, minutes=1)
    assert is_within_check_in_window(_event(), now) is False


def test_window_open_one_minute_before_upper_bound() -> None:
    now = ENDS_AT + timedelta(hours=CHECK_IN_CLOSES_AFTER_END_HOURS) - timedelta(minutes=1)
    assert is_within_check_in_window(_event(), now) is True


def test_window_closed_for_non_published_event() -> None:
    now = STARTS_AT
    assert is_within_check_in_window(_event(status="draft"), now) is False


def test_resolve_status_stays_published_exactly_at_upper_bound() -> None:
    now = ENDS_AT + timedelta(hours=CHECK_IN_CLOSES_AFTER_END_HOURS)
    assert resolve_event_status(_event(), now) == "published"


def test_resolve_status_finished_one_minute_after_upper_bound() -> None:
    now = ENDS_AT + timedelta(hours=CHECK_IN_CLOSES_AFTER_END_HOURS, minutes=1)
    assert resolve_event_status(_event(), now) == "finished"


def test_resolve_status_untouched_for_non_published_event() -> None:
    now = ENDS_AT + timedelta(days=10)
    assert resolve_event_status(_event(status="cancelled"), now) == "cancelled"
