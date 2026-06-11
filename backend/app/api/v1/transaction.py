import os, stripe
from fastapi import APIRouter, HTTPException, Request, Depends
from supabase import create_client
from dotenv import load_dotenv
from pydantic import BaseModel
from app.core.dependencies import get_current_user_id
from typing import Literal

load_dotenv()

router = APIRouter()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

class TransactionCreate(BaseModel):
    listing_id: str
    quantity: float

@router.post("/transactions")
async def create_transaction(payload: TransactionCreate, buyer_id: str = Depends(get_current_user_id)):
    existing = supabase.table("transaction") \
        .select("id") \
        .eq("listing_id", payload.listing_id) \
        .eq("buyer_id", buyer_id) \
        .eq("status", "pending") \
        .execute()
    
    if existing.data:
        existing_txn_id = existing.data[0]["id"]
        existing_payment = supabase.table("payments") \
            .select("stripe_id") \
            .eq("transaction_id", existing_txn_id) \
            .single().execute()
        
        intent = stripe.PaymentIntent.retrieve(existing_payment.data["stripe_id"])
        return {"client_secret": intent.client_secret, "transaction_id": existing_txn_id}
    
    listing = supabase.table("crops_listings").select("id, price, quantity, min_order_quantity, status, seller_id, currency").eq("id", payload.listing_id).single().execute()

    if not listing.data:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.data["status"] != "active":
        raise HTTPException(status_code=400, detail="Listing is no longer active")
    if listing.data["seller_id"] == buyer_id:
        raise HTTPException(status_code=400, detail="You cannot buy your own listing")
    if payload.quantity < listing.data["min_order_quantity"]:
        raise HTTPException(status_code=400, detail=f"Minimum order quantity is {listing.data['min_order_quantity']}")
    if payload.quantity > listing.data["quantity"]:
        raise HTTPException(status_code=400, detail="Requested quantity exceeds available stock")
    
    listing_currency = listing.data["currency"]
    amount = listing.data["price"] * payload.quantity

    txn = supabase.table("transaction").insert({
        "listing_id": payload.listing_id,
        "buyer_id": buyer_id,
        "seller_id": listing.data["seller_id"],
        "quantity": payload.quantity,
        "currency": listing_currency.upper(),
        "status": "pending",
    }).execute()

    txn_id = txn.data[0]["id"]

    intent = stripe.PaymentIntent.create(
        amount=int(amount * 100), # Stripe uses cents
        currency=listing_currency,
        automatic_payment_methods={
            "enabled": True,
            "allow_redirects": "never"  # Card only, no redirects
        },
        metadata={"transaction_id": str(txn_id)}
    )

    supabase.table("payments").insert({
        "transaction_id": txn_id,
        "stripe_id": intent.id,
        "amount": amount,
        "currency": listing_currency.upper(),
        "status": "pending"
    }).execute()

    return {"client_secret": intent.client_secret, "transaction_id": txn_id}

@router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, os.getenv("STRIPE_WEBHOOK_SECRET")
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    if event["type"] == "payment_intent.succeeded":
        metadata = event["data"]["object"]["metadata"]
        txn_id = metadata["transaction_id"] if "transaction_id" in metadata else None
        if not txn_id:
            return {"status": "ignored"}
        supabase.table("payments").update({"status": "paid"}).eq("transaction_id", txn_id).execute()
        supabase.table("transaction").update({"status": "completed"}).eq("id", txn_id).execute()

        # Reduce listing quantity
        txn = supabase.table("transaction").select("listing_id, quantity").eq("id", txn_id).single().execute()
        try:
            supabase.rpc("reduce_listing_quantity", {
                "p_listing_id": txn.data["listing_id"],
                "p_quantity": txn.data["quantity"]
            }).execute()
        except Exception as e:
            print(f"Failed to reduce listing quantity for txn {txn_id}: {e}")
    elif event["type"] in ("payment_intent.payment_failed", "payment_intent.cancelled"):
        metadata = event["data"]["object"]["metadata"]
        txn_id = metadata["transaction_id"] if "transaction_id" in metadata else None
        if not txn_id:
            return {"status": "ignored"}
        supabase.table("payments").update({"status": "failed"}).eq("transaction_id", txn_id).execute()
        supabase.table("transaction").update({"status": "cancelled"}).eq("id", txn_id).execute()

    return {"status": "ok"}

@router.get("/transactions")
async def get_transactions(user_id: str = Depends(get_current_user_id), sort: Literal["asc", "desc"] = "desc"):
    bought = supabase.table("transaction").select("*, listing:crops_listings(*)").eq("buyer_id", user_id).execute()
    sold = supabase.table("transaction").select("*, listing:crops_listings(*)").eq("seller_id", user_id).execute()

    all_txns = bought.data + sold.data
    all_txns.sort(key=lambda x: x.get("created_at", ""), reverse=(sort == "desc"))

    seen = set()
    deduped = []
    for t in all_txns:
        if t["id"] not in seen:
            seen.add(t["id"])
            deduped.append(t)
    return {"transactions": deduped}

@router.get("/transactions/{txn_id}")
async def get_transaction(txn_id: str, user_id: str = Depends(get_current_user_id)):
    txn = supabase.table("transaction").select("*, listing:crops_listings(*)").eq("id", txn_id).single().execute()
    if not txn.data:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.data["buyer_id"] != user_id and txn.data["seller_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this transaction")
    
    payment_res = supabase.table("payments").select("status, amount, currency, stripe_id").eq("transaction_id", txn_id).execute()
    payment_data = payment_res.data[0] if payment_res.data else None
    return {**txn.data, "payment": payment_data}

    return response_data

@router.post("/transactions/{txn_id}/cancel")
async def cancel_transaction(txn_id: str, user_id: str = Depends(get_current_user_id)):
    txn = supabase.table("transaction").select("*").eq("id", txn_id).single().execute()
    if not txn.data:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.data["buyer_id"] != user_id:
        raise HTTPException(status_code=403, detail="Only the buyer can cancel this transaction")
    if txn.data["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot cancel a transaction with status '{txn.data['status']}'")
    
    payment = supabase.table("payments").select("stripe_id").eq("transaction_id", txn_id).single().execute()
    
    try:
        stripe.PaymentIntent.cancel(payment.data["stripe_id"])
    except stripe.error.InvalidRequestError:
        pass  # Already cancelled in Stripe, just update our DB
    
    supabase.table("payments").update({"status": "failed"}).eq("transaction_id", txn_id).execute()
    supabase.table("transaction").update({"status": "cancelled"}).eq("id", txn_id).execute()
    return {"status": "cancelled"}