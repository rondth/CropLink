import os, stripe
from fastapi import APIRouter, HTTPException, Request, Depends
from supabase import create_client
from dotenv import load_dotenv
from pydantic import BaseModel
from app.core.dependencies import get_current_user_id

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
        "currency": payload.currency,
        "status": "pending",
    }).execute()

    txn_id = txn.data[0]["id"]

    intent = stripe.PaymentIntent.create(
        amount=int(payload.amount * 100), # Stripe uses cents
        currency="sgd",
        metadata={"transaction_id": str(txn_id)}
    )

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
    elif event["type"] in ("payment_intent.payment_failed", "payment_intent.cancelled"):
        status_val = "failed" if "failed" in event["type"] else "cancelled"
        txn_id = event["data"]["object"]["metadata"]["transaction_id"]
        supabase.table("payments").update({"status": status_val}).eq("transaction_id", txn_id).execute()
        supabase.table("transaction").update({"status": status_val}).eq("id", txn_id).execute()

    return {"status": "ok"}

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
    
    payment = supabase.table("payments").select("stripe_id").eq("transaction_id", txn_id).single().execute()
    stripe.PaymentIntent.cancel(payment.data["stripe_id"])
    supabase.table("payments").update({"status": "cancelled"}).eq("transaction_id", txn_id).execute()
    supabase.table("transaction").update({"status": "cancelled"}).eq("id", txn_id).execute()
    return {"status": "cancelled"}