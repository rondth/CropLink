from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from app.core.dependencies import get_current_user_id
from app.core.supabase import supabase

router = APIRouter(prefix="/reviews", tags=["reviews"])


class ReviewCreate(BaseModel):
    transaction_id: str
    rating: int = Field(..., ge=1, le=5)
    content: Optional[str] = Field(None, max_length=500)


@router.post("/seller")
def create_seller_review(data: ReviewCreate, reviewer_id: str = Depends(get_current_user_id)):
    txn = supabase.table("transaction").select("*").eq("id", data.transaction_id).single().execute()
    if not txn.data:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.data["status"] != "completed":
        raise HTTPException(status_code=400, detail="Can only review completed transactions")
    if txn.data["buyer_id"] != reviewer_id:
        raise HTTPException(status_code=403, detail="Only the buyer can leave a seller review")

    existing = supabase.table("user_reviews").select("id").eq("transaction_id", data.transaction_id).eq("reviewer_id", reviewer_id).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="You have already reviewed this transaction")

    review = supabase.table("user_reviews").insert({
        "reviewer_id": reviewer_id,
        "seller_id": txn.data["seller_id"],
        "transaction_id": data.transaction_id,
        "rating": data.rating,
        "content": data.content,
    }).execute()

    return review.data[0]


@router.post("/buyer")
def create_buyer_review(data: ReviewCreate, reviewer_id: str = Depends(get_current_user_id)):
    txn = supabase.table("transaction").select("*").eq("id", data.transaction_id).single().execute()

    if not txn.data:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.data["status"] != "completed":
        raise HTTPException(status_code=400, detail="Can only review completed transactions")
    if txn.data["seller_id"] != reviewer_id:
        raise HTTPException(status_code=403, detail="Only the seller can leave a buyer review")
    
    existing = supabase.table("user_reviews").select("id").eq("transaction_id", data.transaction_id).eq("reviewer_id", reviewer_id).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="You have already reviewed this transaction")

    review = supabase.table("user_reviews").insert({
        "reviewer_id": reviewer_id,
        "buyer_id": txn.data["buyer_id"],
        "transaction_id": data.transaction_id,
        "rating": data.rating,
        "content": data.content,
    }).execute()

    return review.data[0]


@router.get("/seller/{seller_id}")
def get_seller_reviews(seller_id: str):
    reviews = (
        supabase.table("user_reviews")
        .select("*, reviewer:profiles!reviewer_id(name, profile_picture_url)")
        .eq("seller_id", seller_id)
        .order("created_at", desc=True)
        .execute()
    )
    return reviews.data


@router.get("/buyer/{buyer_id}")
def get_buyer_reviews(buyer_id: str):
    reviews = (
        supabase.table("user_reviews")
        .select("*, reviewer:profiles!reviewer_id(name, profile_picture_url)")
        .eq("buyer_id", buyer_id)
        .order("created_at", desc=True)
        .execute()
    )
    return reviews.data


@router.get("/mine")
def get_my_reviewed_transactions(reviewer_id: str = Depends(get_current_user_id)):
    reviews = supabase.table("user_reviews").select("transaction_id").eq("reviewer_id", reviewer_id).execute()
    return [r["transaction_id"] for r in reviews.data]


@router.get("/transaction/{txn_id}")
def get_review_by_transaction(txn_id: str, reviewer_id: str = Depends(get_current_user_id)):
    review = supabase.table("user_reviews").select("*").eq("transaction_id", txn_id).execute()
    if not review.data:
        raise HTTPException(status_code=404, detail="No review found")
    return review.data[0]