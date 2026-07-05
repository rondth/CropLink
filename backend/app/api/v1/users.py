from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from app.core.dependencies import get_current_user_id
from app.core.supabase import supabase

router = APIRouter(prefix="/users", tags=["users"])

# SCHEMAS

class BlockResponse(BaseModel):
    id: str
    blocker_id: str
    blocked_id: str
    created_at: Optional[str] = None


class BlockedUser(BaseModel):
    user_id: str
    name: Optional[str] = None
    role: Optional[str] = None
    profile_picture_url: Optional[str] = None
    blocked_at: Optional[str] = None

# ENDPOINTS

# POST /users/{user_id}/block
@router.post("/{user_id}/block", response_model=BlockResponse, status_code=status.HTTP_201_CREATED)
def block_user(user_id: str, blocker_id: str = Depends(get_current_user_id)):
    if user_id == blocker_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot block yourself")

    target = supabase.table("profiles").select("user_id").eq("user_id", user_id).execute()
    if not target.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    existing = (
        supabase.table("blocks")
        .select("id")
        .eq("blocker_id", blocker_id)
        .eq("blocked_id", user_id)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already blocked")

    response = supabase.table("blocks").insert({
        "blocker_id": blocker_id,
        "blocked_id": user_id,
    }).execute()

    return response.data[0]


# POST /users/{user_id}/unblock
@router.post("/{user_id}/unblock", status_code=status.HTTP_204_NO_CONTENT)
def unblock_user(user_id: str, blocker_id: str = Depends(get_current_user_id)):
    existing = (
        supabase.table("blocks")
        .select("id")
        .eq("blocker_id", blocker_id)
        .eq("blocked_id", user_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Block relationship not found")

    supabase.table("blocks").delete().eq("blocker_id", blocker_id).eq("blocked_id", user_id).execute()
    return None


# GET /users/me/blocked
@router.get("/me/blocked", response_model=list[BlockedUser])
def get_blocked_users(blocker_id: str = Depends(get_current_user_id)):
    response = (
        supabase.table("blocks")
        .select("blocked_id, created_at, blocked:profiles!blocks_blocked_id_fkey(user_id, name, role, profile_picture_url)")
        .eq("blocker_id", blocker_id)
        .execute()
    )

    blocked_users = []
    for row in response.data:
        profile = row.get("blocked") or {}
        blocked_users.append({
            "user_id": profile.get("user_id", row["blocked_id"]),
            "name": profile.get("name"),
            "role": profile.get("role"),
            "profile_picture_url": profile.get("profile_picture_url"),
            "blocked_at": row.get("created_at"),
        })

    return blocked_users
