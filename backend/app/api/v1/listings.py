from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator, Field
from typing import Optional, Literal
from datetime import date, datetime, timezone
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
    response = supabase.table("crops_listings").select("*").eq("status", "active").gt("quantity", 0).execute()
    listings = response.data

    seller_ids = list({l["seller_id"] for l in listings if l.get("seller_id")})
    if seller_ids:
        profiles = supabase.table("profiles").select("user_id, name").in_("user_id", seller_ids).execute()
        seller_map = {p["user_id"]: p["name"] for p in profiles.data}
        for listing in listings:
            listing["seller_name"] = seller_map.get(listing.get("seller_id"))

    return listings

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
    decoded_category = unquote(category)
    response = supabase.table("crops_listings").select("*").eq("category", category).eq("status", "active").execute()
    return response.data

#GET /listings/prices
@router.get("/prices")
def get_all_product_price_data(currency:str = "USD"):
    price_response = (
        supabase.table("price_data")
        .select("crop_id, name, avg_price, min_price, max_price, recorded_at, active_listing_count")
        .order("recorded_at", desc=True)
        .execute()
    )
    if not price_response.data:
        raise HTTPException(status_code=404, detail="Price data not found")

    latest_prices = {}
    for row in price_response.data:
        cid = row.get("crop_id")
        if cid and cid not in latest_prices:
            latest_prices[cid] = row
            
    data_list = list(latest_prices.values())
    target_currency = currency.upper()

    if target_currency == "USD":
        for d in data_list:
            if d.get("avg_price") is not None: d["avg_price"] = round(d["avg_price"], 2)
            if d.get("min_price") is not None: d["min_price"] = round(d["min_price"], 2)
            if d.get("max_price") is not None: d["max_price"] = round(d["max_price"], 2)
            d["currency"] = target_currency
        return data_list
    
    rate_response = (
        supabase.table("exchange_rate")
        .select("rate_to_usd")
        .eq("currency", target_currency)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )

    if not rate_response.data:
        raise HTTPException(status_code=404, detail="Exchange rate not found for this currency")
    
    rate_to_usd = rate_response.data[0]["rate_to_usd"]

    zero_decimal_currencies = {"IDR", "LAK", "MMK", "VND"}

    for d in data_list:
        raw_avg = d["avg_price"] / rate_to_usd
        raw_min = d["min_price"] / rate_to_usd
        raw_max = d["max_price"] / rate_to_usd

        if target_currency in zero_decimal_currencies:
            d["avg_price"] = round(raw_avg)
            d["min_price"] = round(raw_min)
            d["max_price"] = round(raw_max)
        else:
            d["avg_price"] = round(raw_avg, 2)
            d["min_price"] = round(raw_min, 2)
            d["max_price"] = round(raw_max, 2)

        d["currency"] = target_currency 

    return data_list

# GET /listings/prices/{produce_id}
@router.get("/prices/{produce_id}")
def get_product_price_data(produce_id: str, currency:str = "USD"):
    price_response = (
        supabase.table("price_data")
        .select("avg_price, min_price, max_price, recorded_at, active_listing_count")
        .eq("crop_id", produce_id)
        .order("recorded_at", desc=True)
        .limit(1)
        .execute()
    )
    if not price_response.data:
        raise HTTPException(status_code=404, detail="Price data not found for this produce")

    data = price_response.data[0]
    target_currency = currency.upper()

    if target_currency == "USD":
        if data.get("avg_price") is not None: data["avg_price"] = round(data["avg_price"], 2)
        if data.get("min_price") is not None: data["min_price"] = round(data["min_price"], 2)
        if data.get("max_price") is not None: data["max_price"] = round(data["max_price"], 2)
        data["currency"] = "USD"
        return data
    
    rate_response = (
        supabase.table("exchange_rate")
        .select("rate_to_usd")
        .eq("currency", target_currency)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )

    if not rate_response.data:
        raise HTTPException(status_code=404, detail="Exchange rate not found for this currency")
    
    rate_to_usd = rate_response.data[0]["rate_to_usd"]
    raw_avg = data["avg_price"] / rate_to_usd
    raw_min = data["min_price"] / rate_to_usd
    raw_max = data["max_price"] / rate_to_usd

    zero_decimal_currencies = {"IDR", "LAK", "MMK", "VND"}

    if target_currency in zero_decimal_currencies:
        data["avg_price"] = round(raw_avg)
        data["min_price"] = round(raw_min)
        data["max_price"] = round(raw_max)
    else:
        data["avg_price"] = round(raw_avg, 2)
        data["min_price"] = round(raw_min, 2)
        data["max_price"] = round(raw_max, 2)

    data["currency"] = target_currency 

    return data

# GET /listings/{id}
# get single listing
@router.get("/{listing_id}")

def get_listing(listing_id: str):
    response = supabase.table("crops_listings").select("*").or_(f"id.eq.{listing_id},produce_id.eq.{listing_id}").limit(1).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Listing not found")

    listing = response.data[0]

    seller_id = listing.get("seller_id")
    if seller_id:
        profile = supabase.table("profiles").select("name").eq("user_id", seller_id).limit(1).execute()
        listing["seller_name"] = profile.data[0].get("name") if profile.data else None

    return listing
    