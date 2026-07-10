from fastapi import APIRouter, Depends

from app.api.v1.messaging import get_unread_conversations
from app.core.dependencies import get_current_user_id

router = APIRouter(prefix="/notifications", tags=["notifications"])


# GET /notifications/messages
@router.get("/messages")
def get_message_notifications(user_id: str = Depends(get_current_user_id)):
    return get_unread_conversations(user_id)
