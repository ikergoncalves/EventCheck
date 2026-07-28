from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_organizer
from app.db.session import get_db
from app.models import Organizer

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentOrganizer = Annotated[Organizer, Depends(get_current_organizer)]
