from types import SimpleNamespace


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
