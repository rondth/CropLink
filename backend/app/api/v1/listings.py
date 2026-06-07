from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import date, datetime
from app.core.dependencies import get_current_user, get_current_user_id
from app.core.supabase import supabase
from urllib.parse import unquote

router = APIRouter(prefix="/listings", tags=["listings"])

# SCHEMAS

class ListingCreate(BaseModel):
    crop_name: str
    category: str
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
    category: Optional[str] = None
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
    decoded_category = unquote(category)
    response = supabase.table("crops_listings").select("*").eq("category", category).eq("status", "active").execute()
    return response.data

#GET /listings/prices
@router.get("/prices")
def get_all_product_price_data(currency:str = "USD"):
    price_response = (
        supabase.table("price_data")
        .select("crop_id, avg_price, min_price, max_price, recorded_at, active_listing_count, name")
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
        .eq("date", date.today().isoformat())
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
        .eq("recorded_at", date.today().isoformat())
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

    return response.data[0]
    