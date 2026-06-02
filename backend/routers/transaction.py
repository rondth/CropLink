import os, stripe
from fastapi import APIRouter, HTTPException, Request
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

@router.post("/transactions")
async def create_transaction(payload: dict):
    txn = supabase.table("transaction").insert({
        "listing_id": payload["listing_id"],
        "buyer_id": payload["buyer_id"],
        "seller_id": payload["seller_id"],
        "quantity": payload["quantity"],
        "currency": payload["currency"],
        "status": "pending",
    }).execute()

    txn_id = txn.data[0]["id"]

    intent = stripe.PaymentIntent.create(
        amount=int(payload["amount"] * 100), # Stripe uses cents
        currency="sgd",
        metadata={"transaction_id": str(txn_id)}
    )

    return {"client_secret": intent.client_secret, "transaction_id": txn_id}