import hashlib
import hmac
import json
import time

from fastapi import APIRouter, HTTPException, Request, status

from app.core.config import settings

router = APIRouter(prefix="/payments", tags=["payments"])

STRIPE_TIMESTAMP_TOLERANCE_SECONDS = 300


def parse_stripe_signature(header: str) -> tuple[int, list[str]]:
    parts = {}
    for item in header.split(","):
        key, _, value = item.partition("=")
        parts.setdefault(key, []).append(value)

    try:
        timestamp = int(parts.get("t", [""])[0])
    except ValueError as exc:
        raise ValueError("Invalid Stripe signature timestamp") from exc

    signatures = [value for value in parts.get("v1", []) if value]
    if not timestamp or not signatures:
        raise ValueError("Missing Stripe signature fields")

    return timestamp, signatures


def verify_stripe_signature(
    payload: bytes,
    header: str,
    secret: str,
    now: int | None = None,
) -> None:
    timestamp, signatures = parse_stripe_signature(header)
    now = now or int(time.time())

    if abs(now - timestamp) > STRIPE_TIMESTAMP_TOLERANCE_SECONDS:
        raise ValueError("Stripe signature timestamp is outside tolerance")

    signed_payload = f"{timestamp}.{payload.decode('utf-8')}".encode("utf-8")
    expected = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()

    if not any(hmac.compare_digest(expected, signature) for signature in signatures):
        raise ValueError("Invalid Stripe signature")


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    if not settings.stripe_webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stripe webhook secret is not configured",
        )

    signature = request.headers.get("stripe-signature")
    if not signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Stripe-Signature header",
        )

    payload = await request.body()
    try:
        verify_stripe_signature(payload, signature, settings.stripe_webhook_secret)
        event = json.loads(payload)
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Stripe webhook payload",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    event_type = event.get("type")
    if not event_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stripe webhook event type is missing",
        )

    return {
        "received": True,
        "event_id": event.get("id"),
        "event_type": event_type,
    }
