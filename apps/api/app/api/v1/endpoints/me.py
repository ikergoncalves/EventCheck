from fastapi import APIRouter

from app.api.deps import CurrentOrganizer
from app.schemas.error import ErrorEnvelope
from app.schemas.organizer import Organizer

router = APIRouter(tags=["system"])


@router.get("/me", response_model=Organizer, responses={401: {"model": ErrorEnvelope}})
async def get_me(organizer: CurrentOrganizer) -> Organizer:
    return Organizer.model_validate(organizer)
