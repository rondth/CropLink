from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
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


class ReportCreate(BaseModel):
    reason: str = Field(..., min_length=10, max_length=500)

    @field_validator("reason")
    @classmethod
    def strip_and_not_empty(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 10:
            raise ValueError("Reason must be at least 10 characters")
        return v


class ReportResponse(BaseModel):
    id: str

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
        .select("id, status")
        .eq("blocker_id", blocker_id)
        .eq("blocked_id", user_id)
        .execute()
    )

    if existing.data:
        row = existing.data[0]
        if row["status"] == "active":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already blocked")

        response = (
            supabase.table("blocks")
            .update({"status": "active", "updated_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", row["id"])
            .execute()
        )
        return response.data[0]

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
        .eq("status", "active")
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Block relationship not found")

    supabase.table("blocks").update({
        "status": "revoked",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("blocker_id", blocker_id).eq("blocked_id", user_id).execute()
    return None


# POST /users/{user_id}/report
@router.post("/{user_id}/report", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def report_user(user_id: str, data: ReportCreate, reporter_id: str = Depends(get_current_user_id)):
    if user_id == reporter_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot report yourself")

    target = supabase.table("profiles").select("user_id").eq("user_id", user_id).execute()
    if not target.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    response = supabase.table("reports").insert({
        "reporter_id": reporter_id,
        "reported_id": user_id,
        "reason": data.reason,
        "status": "pending",
    }).execute()

    return response.data[0]


# GET /users/me/blocked
@router.get("/me/blocked", response_model=list[BlockedUser])
def get_blocked_users(blocker_id: str = Depends(get_current_user_id)):
    response = (
        supabase.table("blocks")
        .select("blocked_id, created_at, blocked:profiles!blocks_blocked_id_fkey(user_id, name, role, profile_picture_url)")
        .eq("blocker_id", blocker_id)
        .eq("status", "active")
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
