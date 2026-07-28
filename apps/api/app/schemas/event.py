import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator, model_validator


class EventStatus(StrEnum):
    draft = "draft"
    published = "published"
    finished = "finished"
    cancelled = "cancelled"


class Event(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organizer_id: uuid.UUID
    title: str
    description: str | None = None
    starts_at: datetime
    ends_at: datetime
    timezone: str
    venue_name: str | None = None
    address: str | None = None
    capacity: int
    status: EventStatus
    tickets_issued: int
    checked_in_count: int
    created_at: datetime
    updated_at: datetime


class EventCreate(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str | None = Field(default=None, max_length=5000)
    starts_at: datetime
    ends_at: datetime
    timezone: str
    venue_name: str | None = None
    address: str | None = None
    capacity: int = Field(ge=1, le=100000)

    @field_validator("ends_at")
    @classmethod
    def ends_at_after_starts_at(cls, value: datetime, info: ValidationInfo) -> datetime:
        starts_at = info.data.get("starts_at")
        if starts_at is not None and value <= starts_at:
            raise ValueError("must be after starts_at")
        return value


class EventUpdate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"minProperties": 1})

    title: str | None = Field(default=None, min_length=3, max_length=120)
    description: str | None = Field(default=None, max_length=5000)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    timezone: str | None = None
    venue_name: str | None = None
    address: str | None = None
    capacity: int | None = Field(default=None, ge=1, le=100000)

    @model_validator(mode="before")
    @classmethod
    def require_at_least_one_field(cls, data: Any) -> Any:
        if isinstance(data, dict) and not data:
            raise ValueError("At least one field must be provided.")
        return data

    @field_validator("ends_at")
    @classmethod
    def ends_at_after_starts_at(
        cls, value: datetime | None, info: ValidationInfo
    ) -> datetime | None:
        starts_at = info.data.get("starts_at")
        if value is not None and starts_at is not None and value <= starts_at:
            raise ValueError("must be after starts_at")
        return value
