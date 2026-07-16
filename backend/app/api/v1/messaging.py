from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field, field_validator

from app.core.dependencies import get_current_user_id
from app.core.supabase import supabase
from app.utils import get_blocked_user_ids, is_blocked_between

UNIQUE_VIOLATION = "23505"

router = APIRouter(prefix="/conversations", tags=["messaging"])

CONVERSATION_SELECT = (
    "id, buyer_id, seller_id, last_message_at,"
    "listing:crops_listings(id, crop_name, photo_url),"
    "buyer:profiles!conversations_buyer_id_fkey(user_id, name, profile_picture_url),"
    "seller:profiles!conversations_seller_id_fkey(user_id, name, profile_picture_url),"
    "messages(content, created_at, sender_id, read_at)"
)

CONVERSATION_DETAIL_SELECT = (
    "id, buyer_id, seller_id,"
    "listing:crops_listings(id, crop_name, photo_url),"
    "buyer:profiles!conversations_buyer_id_fkey(user_id, name, profile_picture_url),"
    "seller:profiles!conversations_seller_id_fkey(user_id, name, profile_picture_url)"
)

PREVIEW_LENGTH = 80

# SCHEMAS

class ConversationCreate(BaseModel):
    listing_id: str


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    client_msg_id: Optional[UUID] = None

    @field_validator("content")
    @classmethod
    def strip_and_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Content cannot be blank or whitespace only")
        return v


# SERVICE FUNCTIONS

def _get_listing_or_404(listing_id: str) -> dict:
    response = (
        supabase.table("crops_listings")
        .select("id, seller_id, crop_name, photo_url")
        .eq("id", listing_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")
    return response.data[0]


def _get_conversation_or_404(conversation_id: str) -> dict:
    response = supabase.table("conversations").select("*").eq("id", conversation_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return response.data[0]


def _ensure_participant(conversation: dict, user_id: str) -> None:
    if user_id not in (conversation["buyer_id"], conversation["seller_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this conversation")


def get_or_create_conversation(listing_id: str, buyer_id: str) -> tuple[dict, bool]:
    listing = _get_listing_or_404(listing_id)
    seller_id = listing["seller_id"]

    if seller_id == buyer_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot message yourself about your own listing")

    if is_blocked_between(supabase, buyer_id, seller_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unable to start a conversation with this user")

    existing = (
        supabase.table("conversations")
        .select("*")
        .eq("listing_id", listing_id)
        .eq("buyer_id", buyer_id)
        .eq("seller_id", seller_id)
        .execute()
    )
    if existing.data:
        return existing.data[0], False

    created = supabase.table("conversations").insert({
        "listing_id": listing_id,
        "buyer_id": buyer_id,
        "seller_id": seller_id,
    }).execute()
    return created.data[0], True


def list_conversations(user_id: str) -> list[dict]:
    response = (
        supabase.table("conversations")
        .select(CONVERSATION_SELECT)
        .or_(f"buyer_id.eq.{user_id},seller_id.eq.{user_id}")
        .order("last_message_at", desc=True, nullsfirst=False)
        .execute()
    )
    conversations = response.data or []
    blocked_ids = get_blocked_user_ids(supabase, user_id)

    result = []
    for convo in conversations:
        messages = sorted(convo.get("messages") or [], key=lambda m: m["created_at"], reverse=True)
        if not messages:
            continue

        other = convo["seller"] if convo["buyer_id"] == user_id else convo["buyer"]
        if (other or {}).get("user_id") in blocked_ids:
            continue

        last_message = {
            "content": messages[0]["content"][:PREVIEW_LENGTH],
            "created_at": messages[0]["created_at"],
        }
        unread_count = sum(
            1 for m in messages if m["sender_id"] != user_id and m.get("read_at") is None
        )

        result.append({
            "id": convo["id"],
            "listing": convo.get("listing"),
            "other_participant": other,
            "last_message": last_message,
            "unread_count": unread_count,
            "last_message_at": convo.get("last_message_at"),
        })

    return result


MAX_NOTIFICATIONS = 10


def get_unread_conversations(user_id: str, limit: int = MAX_NOTIFICATIONS) -> list[dict]:
    """Thin projection over list_conversations for the notification bell --
    same query, same blocked-user exclusion, filtered to unread and capped.
    Conversations are already ordered by last_message_at desc from the query."""
    unread = [c for c in list_conversations(user_id) if c["unread_count"] > 0]
    return [
        {
            "conversation_id": c["id"],
            "other_participant": c["other_participant"],
            "preview": c["last_message"]["content"],
            "unread_count": c["unread_count"],
            "last_message_at": c["last_message_at"],
        }
        for c in unread[:limit]
    ]


def get_conversation_detail(conversation_id: str, user_id: str) -> dict:
    conversation = _get_conversation_or_404(conversation_id)
    _ensure_participant(conversation, user_id)

    response = (
        supabase.table("conversations")
        .select(CONVERSATION_DETAIL_SELECT)
        .eq("id", conversation_id)
        .execute()
    )
    convo = response.data[0]
    other = convo["seller"] if convo["buyer_id"] == user_id else convo["buyer"]

    return {
        "id": convo["id"],
        "listing": convo.get("listing"),
        "other_participant": other,
    }


def get_conversation_messages(
    conversation_id: str, user_id: str, limit: int, before: Optional[str], after: Optional[str] = None
) -> list[dict]:
    conversation = _get_conversation_or_404(conversation_id)
    _ensure_participant(conversation, user_id)

    query = (
        supabase.table("messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=True)
        .limit(limit)
    )
    if before:
        query = query.lt("created_at", before)
    if after:
        query = query.gt("created_at", after)

    return query.execute().data


def mark_conversation_read(conversation_id: str, user_id: str) -> int:
    conversation = _get_conversation_or_404(conversation_id)
    _ensure_participant(conversation, user_id)

    now = datetime.now(timezone.utc).isoformat()
    response = (
        supabase.table("messages")
        .update({"read_at": now})
        .eq("conversation_id", conversation_id)
        .neq("sender_id", user_id)
        .is_("read_at", None)
        .execute()
    )
    return len(response.data or [])


def get_unread_total(user_id: str) -> int:
    response = (
        supabase.table("messages")
        .select("id, conversations!inner(buyer_id, seller_id)")
        .neq("sender_id", user_id)
        .is_("read_at", None)
        .or_(f"buyer_id.eq.{user_id},seller_id.eq.{user_id}", reference_table="conversations")
        .execute()
    )
    rows = response.data or []
    if not rows:
        return 0

    blocked_ids = get_blocked_user_ids(supabase, user_id)
    if not blocked_ids:
        return len(rows)

    def other_participant(row: dict) -> str:
        convo = row["conversations"]
        return convo["seller_id"] if convo["buyer_id"] == user_id else convo["buyer_id"]

    return sum(1 for row in rows if other_participant(row) not in blocked_ids)


def _find_message_by_client_id(conversation_id: str, client_msg_id: str) -> Optional[dict]:
    response = (
        supabase.table("messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .eq("client_msg_id", client_msg_id)
        .execute()
    )
    return response.data[0] if response.data else None


def create_message(
    conversation_id: str, sender_id: str, content: str, client_msg_id: Optional[str] = None
) -> tuple[dict, bool]:
    """Returns (message, created) -- created is False when an existing row for
    (conversation_id, client_msg_id) was returned instead of inserting, which
    makes retried sends safe to replay."""
    conversation = _get_conversation_or_404(conversation_id)
    _ensure_participant(conversation, sender_id)

    other_id = conversation["seller_id"] if sender_id == conversation["buyer_id"] else conversation["buyer_id"]
    if is_blocked_between(supabase, sender_id, other_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unable to send messages to this user")

    if client_msg_id:
        existing = _find_message_by_client_id(conversation_id, client_msg_id)
        if existing:
            return existing, False

    payload = {"conversation_id": conversation_id, "sender_id": sender_id, "content": content}
    if client_msg_id:
        payload["client_msg_id"] = client_msg_id

    try:
        message = supabase.table("messages").insert(payload).execute()
    except APIError as err:
        # Lost the race to a concurrent retry of the same client_msg_id: the
        # unique index rejected our insert, so replay the row it created.
        if client_msg_id and err.code == UNIQUE_VIOLATION:
            existing = _find_message_by_client_id(conversation_id, client_msg_id)
            if existing:
                return existing, False
        raise

    now = datetime.now(timezone.utc).isoformat()
    supabase.table("conversations").update({"last_message_at": now}).eq("id", conversation_id).execute()

    return message.data[0], True


# ENDPOINTS

# POST /conversations
@router.post("/")
def create_conversation(
    data: ConversationCreate,
    response: Response,
    buyer_id: str = Depends(get_current_user_id),
):
    conversation, created = get_or_create_conversation(data.listing_id, buyer_id)
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return conversation


# GET /conversations
@router.get("/")
def get_conversations(user_id: str = Depends(get_current_user_id)):
    return list_conversations(user_id)


# GET /conversations/unread-count
# Must stay registered before GET /{conversation_id}, otherwise that route's
# path param would swallow this literal path first.
@router.get("/unread-count")
def get_unread_count(user_id: str = Depends(get_current_user_id)):
    return {"total": get_unread_total(user_id)}


# GET /conversations/{conversation_id}
@router.get("/{conversation_id}")
def get_conversation(conversation_id: str, user_id: str = Depends(get_current_user_id)):
    return get_conversation_detail(conversation_id, user_id)


# GET /conversations/{conversation_id}/messages
@router.get("/{conversation_id}/messages")
def get_messages(
    conversation_id: str,
    limit: int = Query(50, ge=1, le=100),
    before: Optional[str] = None,
    after: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
):
    return get_conversation_messages(conversation_id, user_id, limit, before, after)


# POST /conversations/{conversation_id}/messages
@router.post("/{conversation_id}/messages", status_code=status.HTTP_201_CREATED)
def send_message(
    conversation_id: str,
    data: MessageCreate,
    response: Response,
    user_id: str = Depends(get_current_user_id),
):
    message, created = create_message(
        conversation_id, user_id, data.content, str(data.client_msg_id) if data.client_msg_id else None
    )
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return message


# PATCH /conversations/{conversation_id}/read
@router.patch("/{conversation_id}/read")
def read_conversation(conversation_id: str, user_id: str = Depends(get_current_user_id)):
    return {"marked_count": mark_conversation_read(conversation_id, user_id)}
