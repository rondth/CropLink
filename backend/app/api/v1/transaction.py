import os, stripe
from fastapi import APIRouter, HTTPException, Request, Depends
from supabase import create_client
from dotenv import load_dotenv
from pydantic import BaseModel
from app.core.dependencies import get_current_user_id
from typing import Literal
import stripe

load_dotenv()

router = APIRouter()
PLATFORM_FEE_RATE = 0.02 # 2%

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

class TransactionCreate(BaseModel):
    listing_id: str
    quantity: float

class TransactionUpdate(BaseModel):
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
            .execute()
        if existing_payment.data:
            intent = stripe.PaymentIntent.retrieve(existing_payment.data[0]["stripe_id"])
            reusable = {"requires_payment_method", "requires_confirmation", "requires_action"}
            if intent.status in reusable:
                return {"client_secret": intent.client_secret, "transaction_id": existing_txn_id}
        supabase.table("payments").delete().eq("transaction_id", existing_txn_id).execute()
        supabase.table("transaction").delete().eq("id", existing_txn_id).execute()
        
    listing = supabase.table("crops_listings").select("id, price, quantity, min_order_quantity, status, seller_id, currency").eq("id", payload.listing_id).single().execute()

    if not listing.data:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.data["status"] != "active":
        raise HTTPException(status_code=400, detail="Listing is no longer active")
    if listing.data["seller_id"] == buyer_id:
        raise HTTPException(status_code=400, detail="You cannot buy your own listing")
    min_qty = listing.data.get("min_order_quantity")
    if min_qty is not None and payload.quantity < min_qty:
        raise HTTPException(status_code=400, detail=f"Minimum order quantity is {min_qty}")
    if payload.quantity > listing.data["quantity"]:
        raise HTTPException(status_code=400, detail="Requested quantity exceeds available stock")

    listing_currency = listing.data.get("currency") or "USD"
    subtotal = listing.data["price"] * payload.quantity
    platform_fee = round(subtotal * PLATFORM_FEE_RATE, 2)
    total = round(subtotal + platform_fee, 2)

    txn = supabase.table("transaction").insert({
        "listing_id": payload.listing_id,
        "buyer_id": buyer_id,
        "seller_id": listing.data["seller_id"],
        "quantity": payload.quantity,
        "currency": listing_currency.upper(),
        "status": "pending",
    }).execute()

    txn_id = txn.data[0]["id"]

    try:
        intent = stripe.PaymentIntent.create(
            amount=int(total * 100),  # in cents
            currency=listing_currency.lower(),
            automatic_payment_methods={
                "enabled": True,
                "allow_redirects": "never"  # card only, no redirects
            },
            metadata={"transaction_id": str(txn_id)}
        )
    except stripe.error.InvalidRequestError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Payment failed: {str(e.user_message or e)}"
        )

    supabase.table("payments").insert({
        "transaction_id": txn_id,
        "stripe_id": intent.id,
        "amount": total,
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
        txn_id = metadata.get("transaction_id")
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
    elif event["type"] == "payment_intent.payment_failed":
        metadata = event["data"]["object"]["metadata"]
        txn_id = metadata.get("transaction_id")
        if not txn_id:
            return {"status": "ignored"}
        supabase.table("payments").update({"status": "failed"}).eq("transaction_id", txn_id).execute()
    elif event["type"] == "payment_intent.cancelled":
        metadata = event["data"]["object"]["metadata"]
        txn_id = metadata.get("transaction_id")
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
    
    payment_res = supabase.table("payments").select("status, amount, currency").eq("transaction_id", txn_id).execute()
    return {**txn.data, "payment": payment_res.data[0] if payment_res.data else None}

@router.post("/transactions/{txn_id}/cancel")
async def cancel_transaction(txn_id: str, user_id: str = Depends(get_current_user_id)):
    txn = supabase.table("transaction").select("*").eq("id", txn_id).single().execute()
    if not txn.data:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.data["buyer_id"] != user_id:
        raise HTTPException(status_code=403, detail="Only the buyer can cancel this transaction")
    if txn.data["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot cancel a transaction with status '{txn.data['status']}'")
    
    payment_res = supabase.table("payments").select("stripe_id").eq("transaction_id", txn_id).execute()
    if payment_res.data:
        try:
            stripe.PaymentIntent.cancel(payment_res.data[0]["stripe_id"])
        except stripe.error.InvalidRequestError:
            pass
        supabase.table("payments").update({"status": "failed"}).eq("transaction_id", txn_id).execute()
    supabase.table("transaction").update({"status": "cancelled"}).eq("id", txn_id).execute()
    return {"status": "cancelled"}

@router.get("/transactions/{txn_id}/client-secret")
async def get_client_secret(txn_id: str, user_id: str = Depends(get_current_user_id)):
    txn = supabase.table("transaction").select("*").eq("id", txn_id).single().execute()
    if not txn.data:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.data["buyer_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if txn.data["status"] != "pending":
        raise HTTPException(status_code=400, detail="Transaction is not pending")
    
    payment = supabase.table("payments").select("stripe_id").eq("transaction_id", txn_id).single().execute()
    if not payment.data:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    intent = stripe.PaymentIntent.retrieve(payment.data["stripe_id"])
    return {"client_secret": intent.client_secret}

@router.patch("/transactions/{txn_id}")
async def update_transaction(txn_id: str, payload: TransactionUpdate, user_id: str = Depends(get_current_user_id)):
    txn = supabase.table("transaction").select("*").eq("id", txn_id).single().execute()
    if not txn.data:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.data["buyer_id"] != user_id:
        raise HTTPException(status_code=403, detail="Only the buyer can edit this transaction")
    if txn.data["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot edit a transaction with status '{txn.data['status']}'")

    listing = supabase.table("crops_listings") \
        .select("price, quantity, min_order_quantity") \
        .eq("id", txn.data["listing_id"]).single().execute()

    if not listing.data:
        raise HTTPException(status_code=404, detail="Listing not found")

    min_qty = listing.data.get("min_order_quantity")
    if min_qty is not None and payload.quantity < min_qty:
        raise HTTPException(status_code=400, detail=f"Minimum order quantity is {min_qty}")
    if payload.quantity > listing.data["quantity"]:
        raise HTTPException(status_code=400, detail="Requested quantity exceeds available stock")

    subtotal = listing.data["price"] * payload.quantity
    platform_fee = round(subtotal * PLATFORM_FEE_RATE, 2)
    new_total = round(subtotal + platform_fee, 2)

    payment_res = supabase.table("payments").select("stripe_id").eq("transaction_id", txn_id).execute()
    if payment_res.data:
        try:
            stripe.PaymentIntent.modify(
                payment_res.data[0]["stripe_id"],
                amount=int(new_total * 100)
            )
            supabase.table("payments").update({"amount": new_total}).eq("transaction_id", txn_id).execute()
        except stripe.error.InvalidRequestError as e:
            raise HTTPException(status_code=400, detail=f"Could not update payment: {str(e)}")

    supabase.table("transaction").update({"quantity": payload.quantity}).eq("id", txn_id).execute()
    updated = supabase.table("transaction").select("*, listing:crops_listings(*)").eq("id", txn_id).single().execute()
    return updated.data