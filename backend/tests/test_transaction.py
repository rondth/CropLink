from types import SimpleNamespace
from unittest.mock import MagicMock


class TestCreateTransactionBlocking:
    def test_403_when_seller_has_blocked_buyer(self, authed_client, supabase_mock, monkeypatch):
        supabase_mock.table(
            "transaction"
        ).select.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[])
        )
        supabase_mock.table(
            "crops_listings"
        ).select.return_value.eq.return_value.single.return_value.execute.return_value = SimpleNamespace(
            data={
                "id": "listing-1",
                "price": 10,
                "quantity": 100,
                "min_order_quantity": 1,
                "status": "active",
                "seller_id": "blocked-seller",
                "currency": "USD",
            }
        )
        monkeypatch.setattr(
            "app.api.v1.transaction.get_blocked_user_ids", lambda supabase, user_id: {"blocked-seller"}
        )

        response = authed_client.post("/api/v1/transactions", json={"listing_id": "listing-1", "quantity": 5})

        assert response.status_code == 403

    def test_403_when_buyer_has_blocked_seller(self, authed_client, supabase_mock, monkeypatch, current_user):
        supabase_mock.table(
            "transaction"
        ).select.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[])
        )
        supabase_mock.table(
            "crops_listings"
        ).select.return_value.eq.return_value.single.return_value.execute.return_value = SimpleNamespace(
            data={
                "id": "listing-1",
                "price": 10,
                "quantity": 100,
                "min_order_quantity": 1,
                "status": "active",
                "seller_id": "seller-1",
                "currency": "USD",
            }
        )

        def fake_get_blocked_user_ids(supabase, user_id):
            assert user_id == current_user["sub"]
            return {"seller-1"}

        monkeypatch.setattr("app.api.v1.transaction.get_blocked_user_ids", fake_get_blocked_user_ids)

        response = authed_client.post("/api/v1/transactions", json={"listing_id": "listing-1", "quantity": 5})

        assert response.status_code == 403

    def test_404_still_takes_priority_over_block_check(self, authed_client, supabase_mock, monkeypatch):
        supabase_mock.table(
            "transaction"
        ).select.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[])
        )
        supabase_mock.table(
            "crops_listings"
        ).select.return_value.eq.return_value.single.return_value.execute.return_value = SimpleNamespace(data=None)
        monkeypatch.setattr(
            "app.api.v1.transaction.get_blocked_user_ids",
            lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("should not be reached")),
        )

        response = authed_client.post("/api/v1/transactions", json={"listing_id": "missing", "quantity": 5})

        assert response.status_code == 404


class TestStripeWebhookSetsPaid:
    def test_payment_intent_succeeded_sets_transaction_status_to_paid(self, client, supabase_mock, monkeypatch):
        monkeypatch.setattr(
            "app.api.v1.transaction.stripe.Webhook.construct_event",
            lambda payload, sig_header, secret: {
                "type": "payment_intent.succeeded",
                "data": {"object": {"metadata": {"transaction_id": "txn-1"}}},
            },
        )
        supabase_mock.table(
            "transaction"
        ).select.return_value.eq.return_value.execute.return_value = SimpleNamespace(
            data=[{"listing_id": "listing-1", "quantity": 5}]
        )
        supabase_mock.rpc.return_value.execute.return_value = SimpleNamespace(data=None)

        response = client.post(
            "/api/v1/stripe/webhook", content=b"{}", headers={"stripe-signature": "sig"}
        )

        assert response.status_code == 200
        supabase_mock.table("transaction").update.assert_any_call({"status": "paid"})
        supabase_mock.table("payments").update.assert_any_call({"status": "paid"})


class TestCompleteTransaction:
    def test_403_when_not_the_seller(self, authed_as, supabase_mock):
        client = authed_as(user_id="not-the-seller")
        supabase_mock.table(
            "transaction"
        ).select.return_value.eq.return_value.single.return_value.execute.return_value = SimpleNamespace(
            data={"id": "txn-1", "status": "paid", "seller_id": "seller-1", "buyer_id": "buyer-1"}
        )

        response = client.post("/api/v1/transactions/txn-1/complete")

        assert response.status_code == 403

    def test_400_when_status_is_not_paid(self, authed_as, supabase_mock):
        client = authed_as(user_id="seller-1")
        supabase_mock.table(
            "transaction"
        ).select.return_value.eq.return_value.single.return_value.execute.return_value = SimpleNamespace(
            data={"id": "txn-1", "status": "pending", "seller_id": "seller-1", "buyer_id": "buyer-1"}
        )

        response = client.post("/api/v1/transactions/txn-1/complete")

        assert response.status_code == 400

    def test_seller_can_mark_paid_transaction_as_completed(self, authed_as, supabase_mock):
        client = authed_as(user_id="seller-1")
        supabase_mock.table(
            "transaction"
        ).select.return_value.eq.return_value.single.return_value.execute.return_value = SimpleNamespace(
            data={"id": "txn-1", "status": "paid", "seller_id": "seller-1", "buyer_id": "buyer-1"}
        )
        supabase_mock.table(
            "transaction"
        ).select.return_value.eq.return_value.execute.return_value = SimpleNamespace(
            data=[{"id": "txn-1", "status": "completed", "seller_id": "seller-1", "buyer_id": "buyer-1"}]
        )

        response = client.post("/api/v1/transactions/txn-1/complete")

        assert response.status_code == 200
        assert response.json()["status"] == "completed"
        supabase_mock.table("transaction").update.assert_any_call({"status": "completed"})
