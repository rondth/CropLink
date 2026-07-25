from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import get_current_user, get_current_user_id
from app.core.supabase import supabase
from app.utils import get_blocked_user_ids

router = APIRouter(prefix="/distributors", tags=["distributors"])


@router.get("/recommended")
def get_recommended_distributors(
    limit: int = 10,
    user_id: str = Depends(get_current_user_id),
    user: dict = Depends(get_current_user),
):
    role = user.get("user_metadata", {}).get("role")
    if role != "seller":
        raise HTTPException(status_code=403, detail="Only sellers can view recommended distributors")

    excluded_ids = get_blocked_user_ids(supabase, user_id)

    buyers_query = supabase.table("profiles").select("user_id, name, profile_picture_url, trust_score, trust_score_basis").eq("role", "buyer")
    if excluded_ids:
        buyers_query = buyers_query.not_.in_("user_id", list(excluded_ids))
    buyers = buyers_query.execute().data
    if not buyers:
        return []

    results = [
        {
            "buyer_id": buyer["user_id"],
            "name": buyer.get("name"),
            "profile_picture_url": buyer.get("profile_picture_url"),
            "trust_score": buyer.get("trust_score", 2.5),
            "trust_score_basis": buyer.get("trust_score_basis") or "New user (no trust history yet)",
        }
        for buyer in buyers
    ]

    results.sort(key=lambda r: r["trust_score"], reverse=True)
    return results[:limit]