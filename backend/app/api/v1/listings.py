from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator, Field
from typing import Optional, Literal
from datetime import datetime, timezone
from app.core.dependencies import get_current_user, get_current_user_id
from app.core.supabase import supabase
from urllib.parse import unquote

router = APIRouter(prefix="/listings", tags=["listings"])

# SCHEMAS

class ListingCreate(BaseModel):
    crop_name: str = Field(..., min_length=1, max_length=100)
    category: str = Field(..., min_length=1, max_length=50)
    currency: str
    price: float = Field(..., gt=0)
    unit_of_measurement: str
    quantity: float = Field(..., gt=0)
    photo_url: Optional[str] = None
    harvested_at: datetime
    description: Optional[str] = Field(None, max_length=500)
    location: str = Field(..., min_length=1, max_length=100)
    min_order_quantity: float = Field(..., gt=0)

    @field_validator("crop_name", "category", "location")
    @classmethod
    def strip_and_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Cannot be blank or whitespace only")
        return v
    
    @field_validator("harvested_at")
    @classmethod
    def not_future_date(cls, v: datetime) -> datetime:
        now = datetime.now(timezone.utc)
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        if v > now:
            raise ValueError("Harvest date cannot be in the future")
        return v
    
    @field_validator("min_order_quantity")
    @classmethod
    def min_order_lte_quantity(cls, v: float, info) -> float:
        quantity = info.data.get("quantity")
        if quantity is not None and v > quantity:
            raise ValueError("Minimum order quantity cannot exceed total quantity")
        return v

class ListingUpdate(BaseModel):
    crop_name: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = Field(None, min_length=1, max_length=50)
    price: Optional[float] = Field(None, gt=0)
    currency: Optional[str] = None
    quantity: Optional[float] = Field(None, gt=0)
    unit_of_measurement: Optional[str] = None
    photo_url: Optional[str] = None
    status: Optional[Literal['active', 'sold', 'inactive']] = None
    harvested_at: Optional[datetime] = None
    description: Optional[str] = Field(None, max_length=500)
    location: Optional[str] = Field(None, min_length=1, max_length=100)
    min_order_quantity: Optional[float] = Field(None, gt=0)

    @field_validator("crop_name", "category", "location")
    @classmethod
    def strip_and_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Cannot be blank or whitespace only")
        return v
    
    @field_validator("harvested_at")
    @classmethod
    def not_future_date(cls, v: datetime) -> datetime:
        now = datetime.now(timezone.utc)
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        if v > now:
            raise ValueError("Harvest date cannot be in the future")
        return v
    
    @field_validator("min_order_quantity")
    @classmethod
    def min_order_lte_quantity(cls, v: float, info) -> float:
        quantity = info.data.get("quantity")
        if quantity is not None and v > quantity:
            raise ValueError("Minimum order quantity cannot exceed total quantity")
        return v
    
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
@router.get("/")
def get_listings():
    response = supabase.table("crops_listings").select("*").eq("status", "active").execute()
    return response.data

# GET /listings/me
@router.get("/me")
def get_my_listings(user_id: str = Depends(get_current_user_id), user: dict = Depends(get_current_user)):
    response = supabase.table("crops_listings").select("*").eq("seller_id", user_id).execute()
    return response.data

# GET /categories
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
    decoded_category = unquote(category)
    response = supabase.table("crops_listings").select("*").eq("category", decoded_category).eq("status", "active").execute()
    return response.data

# GET /listings/{listing_id}
@router.get("/{listing_id}")
def get_listing(listing_id: str):
    response = supabase.table("crops_listings").select("*").eq("id", listing_id).single().execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Listing not found")

    return response.data

# PATCH /listings/{listing_id}
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
    
    existing_record = existing.data[0]
    new_moq = dump.get("min_order_quantity", existing_record["min_order_quantity"])
    new_qty = dump.get("quantity", existing_record["quantity"])
    if new_moq > new_qty:
        raise HTTPException(status_code=422, detail="Minimum order quantity cannot exceed quantity")

    response = supabase.table("crops_listings").update(dump).eq("id", listing_id).execute()
    return response.data[0]

# DELETE /listings/{listing_id}
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
