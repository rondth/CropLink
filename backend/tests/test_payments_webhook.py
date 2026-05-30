import hashlib
import hmac
import json
import os
import time
import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")
os.environ.setdefault("SUPABASE_JWT_PUBLIC_KEY", "{}")
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"

from app.api.v1.payments import router, settings  # noqa: E402


def stripe_signature(payload: bytes, secret: str, timestamp: int | None = None) -> str:
    timestamp = timestamp or int(time.time())
    signed_payload = f"{timestamp}.{payload.decode('utf-8')}".encode("utf-8")
    digest = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={digest}"


class StripeWebhookTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router, prefix="/api/v1")
        self.client = TestClient(app)

    def test_accepts_valid_signed_webhook(self):
        payload = json.dumps({
            "id": "evt_test",
            "type": "checkout.session.completed",
        }).encode("utf-8")

        response = self.client.post(
            "/api/v1/payments/stripe/webhook",
            content=payload,
            headers={"stripe-signature": stripe_signature(payload, "whsec_test")},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["event_type"], "checkout.session.completed")

    def test_rejects_missing_signature(self):
        response = self.client.post(
            "/api/v1/payments/stripe/webhook",
            json={"type": "checkout.session.completed"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Missing Stripe-Signature header")

    def test_rejects_invalid_signature(self):
        payload = b'{"type":"checkout.session.completed"}'

        response = self.client.post(
            "/api/v1/payments/stripe/webhook",
            content=payload,
            headers={"stripe-signature": "t=123,v1=bad"},
        )

        self.assertEqual(response.status_code, 400)

    def test_rejects_when_secret_is_not_configured(self):
        original = settings.stripe_webhook_secret
        settings.stripe_webhook_secret = None
        try:
            response = self.client.post(
                "/api/v1/payments/stripe/webhook",
                json={"type": "checkout.session.completed"},
            )
        finally:
            settings.stripe_webhook_secret = original

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["detail"], "Stripe webhook secret is not configured")


if __name__ == "__main__":
    unittest.main()
