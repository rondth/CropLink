from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import get_current_user, get_current_user_id
from app.core.supabase import supabase
from app.utils import score_buyer

router = APIRouter(prefix="/distributors", tags=["distributors"])


@router.get("/recommended")
def get_recommended_distributors(
    category: Optional[str] = None,
    limit: int = 10,
    user_id: str = Depends(get_current_user_id),
    user: dict = Depends(get_current_user),
):
    role = user.get("user_metadata", {}).get("role")
    if role != "seller":
        raise HTTPException(status_code=403, detail="Only sellers can view recommended distributors")

    buyers = supabase.table("profiles").select("user_id, name, profile_picture_url").eq("role", "buyer").execute().data
    if not buyers:
        return []
    buyer_ids = [b["user_id"] for b in buyers]

    reviews = supabase.table("user_reviews").select("buyer_id, rating").in_("buyer_id", buyer_ids).execute().data
    review_totals: dict[str, list[int]] = {}
    for r in reviews:
        if r.get("buyer_id"):
            review_totals.setdefault(r["buyer_id"], []).append(r["rating"])

    txn_query = (
        supabase.table("transaction")
        .select("buyer_id, listing:crops_listings(category)")
        .eq("seller_id", user_id)
        .eq("status", "completed")
        .in_("buyer_id", buyer_ids)
        .execute()
    )
    category_matches: dict[str, int] = {}
    for txn in txn_query.data:
        listing = txn.get("listing") or {}
        if category and listing.get("category") != category:
            continue

        buyer_id = txn.get("buyer_id")
        if buyer_id:
            category_matches[buyer_id] = category_matches.get(buyer_id, 0) + 1

    results = []
    
    for buyer in buyers:
        buyer_id = buyer["user_id"]
        ratings = review_totals.get(buyer_id, [])
        review_score = round(sum(ratings) / len(ratings), 2) if ratings else None
        match_count = category_matches.get(buyer_id, 0)
        score, basis = score_buyer(review_score, match_count)

        results.append({
            "buyer_id": buyer_id,
            "name": buyer.get("name"),
            "profile_picture_url": buyer.get("profile_picture_url"),
            "review_score": review_score,
            "review_count": len(ratings),
            "category_match_count": match_count,
            "score": round(score, 2),
            "basis": basis,
        })

    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:limit]