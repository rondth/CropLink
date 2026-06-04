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
    seller_id: str
    quantity: float
    amount: float
    currency: str = "sgd"

@router.post("/transactions")
async def create_transaction(payload: TransactionCreate, buyer_id: str = Depends(get_current_user_id)):
    txn = supabase.table("transaction").insert({
        "listing_id": payload.listing_id,
        "buyer_id": buyer_id,
        "seller_id": payload.seller_id,
        "quantity": payload.quantity,
        "amount": payload.amount,
        "currency": payload.currency,
        "status": "pending",
    }).execute()

    txn_id = txn.data[0]["id"]

    intent = stripe.PaymentIntent.create(
        amount=int(payload.amount * 100), # Stripe uses cents
        currency="sgd",
        metadata={"transaction_id": str(txn_id)}
    )

    listing = supabase.table("crops_listings").select("quantity, min_order_quantity, status, seller_id").eq("id", payload.listing_id).single().execute()

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

    supabase.table("payments").insert({
        "transaction_id": txn_id,
        "stripe_id": intent.id,
        "amount": payload.amount,
        "currency": payload.currency,
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
        txn_id = event["data"]["object"]["metadata"]["transaction_id"]
        supabase.table("payments").update({"status": "completed"}).eq("transaction_id", txn_id).execute()
        supabase.table("transaction").update({"status": "completed"}).eq("id", txn_id).execute()

        # Reduce listing quantity
        txn = supabase.table("transaction").select("listing_id", "quantity").eq("id", txn_id).single().execute()
        listing = supabase.table("crops_listings").select("quantity").eq("id", txn.data["listing_id"]).single().execute()
        new_qty = listing.data["quantity"] - txn.data["quantity"]
        supabase.table("crops_listings").update({
            "quantity": new_qty, 
            "status": "sold" if new_qty == 0 else listing.data["status"]
        }).eq("id", txn.data["listing_id"]).execute()
    elif event["type"] in ("payment_intent.payment_failed", "payment_intent.cancelled"):
        status_val = "failed" if "failed" in event["type"] else "cancelled"
        txn_id = event["data"]["object"]["metadata"]["transaction_id"]
        supabase.table("payments").update({"status": status_val}).eq("transaction_id", txn_id).execute()
        supabase.table("transaction").update({"status": status_val}).eq("id", txn_id).execute()

    return {"status": "ok"}

@router.get("/transactions")
async def get_transactions(user_id: str = Depends(get_current_user_id), sort: Literal["asc", "desc"] = "desc"):
    bought = supabase.table("transaction").select("*").eq("buyer_id", user_id).execute()
    sold = supabase.table("transaction").select("*").eq("seller_id", user_id).execute()

    all_txns = bought.data + sold.data

    all_txns.sort(key=lambda x: x.get("created_at", ""), reverse=(sort == "desc"))
    return {"transactions": all_txns}

@router.get("/transactions/{txn_id}")
async def get_transaction(txn_id: str, user_id: str = Depends(get_current_user_id)):
    txn = supabase.table("transaction").select("*").eq("id", txn_id).single().execute()
    if not txn.data:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.data["buyer_id"] != user_id and txn.data["seller_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this transaction")
    
    payment = supabase.table("payments").select("status, amount, currency").eq("transaction_id", txn_id).single().execute()
    return {**txn.data, "payment": payment.data}

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
    stripe.PaymentIntent.cancel(payment.data["stripe_id"])
    supabase.table("payments").update({"status": "cancelled"}).eq("transaction_id", txn_id).execute()
    supabase.table("transaction").update({"status": "cancelled"}).eq("id", txn_id).execute()
    return {"status": "cancelled"}