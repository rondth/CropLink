from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime
from app.core.dependencies import get_current_user, get_current_user_id
from app.core.supabase import supabase

router = APIRouter(prefix="/listings", tags=["listings"])

# SCHEMAS

class ListingCreate(BaseModel):
    crop_name: str
    currency: str
    price: float
    unit_of_measurement: str
    quantity: float
    photo_url: Optional[str] = None
    status: Literal['active']
    harvested_at: datetime
    description: Optional[str] = None
    location: str
    min_order_quantity: float

class ListingUpdate(BaseModel):
    crop_name: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    quantity: Optional[float] = None
    unit_of_measurement: Optional[str] = None
    photo_url: Optional[str] = None
    status: Optional[Literal['active', 'sold', 'inactive']] = None
    harvested_at: Optional[datetime] = None
    description: Optional[str] = None
    location: Optional[str] = None
    min_order_quantity: Optional[float] = None

# ENDPOINTS

# POST /listings
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_listing(
    data: ListingCreate,
    user_id: str = Depends(get_current_user_id),
    user: dict = Depends(get_current_user)
):
    role = user.get("user_metadata", {}).get("role")
    if role != "seller":
        raise HTTPException(status_code=403, detail="Only sellers can create listings")
    
    dump = data.model_dump(exclude_none=True)

    # Convert datetime to ISO string for Supabase
    if "harvested_at" in dump:
        dump["harvested_at"] = dump["harvested_at"].isoformat()

    response = supabase.table("crops_listings").insert({
        **dump,
        "seller_id": user_id,
        "status": "active"
    }).execute()

    return response.data[0]

# GET /listings
# get all listing
@router.get("/")
def get_listings():
    response = supabase.table("crops_listings").select("*").eq("status", "active").execute()
    return response.data

# GET /listings/me
# get all listing of current logged user
@router.get("/me")
def get_my_listings(user_id: str = Depends(get_current_user_id), user: dict = Depends(get_current_user)):
    response = supabase.table("crops_listings").select("*").eq("seller_id", user_id).execute()
    return response.data


# PATCH /listings/{id}
@router.patch("/{listing_id}")
def update_listing(
    listing_id: str,
    data: ListingUpdate,
    user_id: str = Depends(get_current_user_id),
    user: dict = Depends(get_current_user)
):
    existing = supabase.table("crops_listings").select("*").eq("id", listing_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Listing not found")
    if existing.data[0]["seller_id"] != user_id:
        raise HTTPException(status_code=403, detail="You can only edit your own listings")
    
    dump = data.model_dump(exclude_unset=True)

    if "harvested_at" in dump:
        dump["harvested_at"] = dump["harvested_at"].isoformat()

    if not dump:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    response = supabase.table("crops_listings").update(dump).eq("id", listing_id).execute()
    return response.data[0]

# DELETE /listings/{id}
@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_listing(
    listing_id: str,
    user_id: str = Depends(get_current_user_id),
    user: dict = Depends(get_current_user)
):
    existing = supabase.table("crops_listings").select("*").eq("id", listing_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Listing not found")
    if existing.data[0]["seller_id"] != user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own listings")
    
    supabase.table("crops_listings").delete().eq("id", listing_id).execute()
    return None 


# GET categories
@router.get("/categories", response_model=list[str])
def get_categories():
    response = supabase.table("crops_listings").select("category").execute()
    
    if not response.data:
        return []

    categories = set()
    for item in response.data:
        category_name = item.get('category')
        if category_name:
            categories.add(category_name)
            
    return sorted(list(categories))


# GET /listings/category/{category}
@router.get("/category/{category}")
def get_listings_by_category(category: str):
    response = supabase.table("crops_listings").select("*").eq("category", category).eq("status", "active").execute()
    return response.data

# GET /listings/{id}
# get single listing
@router.get("/{listing_id}")
def get_listing(listing_id: str):
    response = supabase.table("crops_listings").select("*").eq("id", listing_id).single().execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Listing not found")

    return response.data
