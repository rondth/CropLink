from types import SimpleNamespace


def valid_listing_payload(**overrides):
    payload = {
        "crop_name": "Tomato",
        "category": "Vegetable",
        "currency": "USD",
        "price": 10,
        "unit_of_measurement": "kg",
        "quantity": 100,
        "harvested_at": "2024-01-01T00:00:00Z",
        "location": "Farm A",
        "min_order_quantity": 5,
    }
    payload.update(overrides)
    return payload


class TestCreateListing:
    def test_creates_listing_for_seller(self, authed_client, supabase_mock):
        supabase_mock.table("crops_listings").insert.return_value.execute.return_value = SimpleNamespace(
            data=[{"id": "listing-1", "crop_name": "Tomato", "status": "active"}]
        )

        response = authed_client.post("/api/v1/listings/", json=valid_listing_payload())

        assert response.status_code == 201
        assert response.json()["id"] == "listing-1"

    def test_rejects_non_seller(self, authed_as):
        client = authed_as(role="buyer")

        response = client.post("/api/v1/listings/", json=valid_listing_payload())

        assert response.status_code == 403

    def test_rejects_min_order_exceeding_quantity(self, authed_client):
        response = authed_client.post(
            "/api/v1/listings/", json=valid_listing_payload(quantity=5, min_order_quantity=10)
        )

        assert response.status_code == 422

    def test_rejects_future_harvest_date(self, authed_client):
        response = authed_client.post(
            "/api/v1/listings/", json=valid_listing_payload(harvested_at="2099-01-01T00:00:00Z")
        )

        assert response.status_code == 422


class TestGetListings:
    def test_includes_seller_names(self, client, supabase_mock):
        supabase_mock.table("crops_listings").select.return_value.eq.return_value.gt.return_value.execute.return_value = (
            SimpleNamespace(data=[{"id": "1", "seller_id": "user-1", "crop_name": "Tomato"}])
        )
        supabase_mock.table("profiles").select.return_value.in_.return_value.execute.return_value = SimpleNamespace(
            data=[{"user_id": "user-1", "name": "Farmer Joe"}]
        )

        response = client.get("/api/v1/listings/")

        assert response.status_code == 200
        assert response.json()[0]["seller_name"] == "Farmer Joe"

    def test_returns_empty_list_when_no_listings(self, client, supabase_mock):
        supabase_mock.table("crops_listings").select.return_value.eq.return_value.gt.return_value.execute.return_value = (
            SimpleNamespace(data=[])
        )

        response = client.get("/api/v1/listings/")

        assert response.status_code == 200
        assert response.json() == []


class TestGetMyListings:
    def test_returns_only_own_listings(self, authed_client, supabase_mock, current_user):
        supabase_mock.table("crops_listings").select.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[{"id": "1", "seller_id": current_user["sub"]}])
        )

        response = authed_client.get("/api/v1/listings/me")

        assert response.status_code == 200
        assert response.json()[0]["seller_id"] == current_user["sub"]

    def test_requires_authentication(self, client):
        response = client.get("/api/v1/listings/me")

        assert response.status_code == 401


class TestUpdateListing:
    def test_404_when_not_found(self, authed_client, supabase_mock):
        supabase_mock.table("crops_listings").select.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[])
        )

        response = authed_client.patch("/api/v1/listings/listing-1", json={"price": 5})

        assert response.status_code == 404

    def test_forbidden_for_non_owner(self, authed_client, supabase_mock):
        supabase_mock.table("crops_listings").select.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[{"id": "listing-1", "seller_id": "someone-else"}])
        )

        response = authed_client.patch("/api/v1/listings/listing-1", json={"price": 5})

        assert response.status_code == 403

    def test_rejects_empty_update(self, authed_client, supabase_mock, current_user):
        supabase_mock.table("crops_listings").select.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(
                data=[{"id": "listing-1", "seller_id": current_user["sub"], "quantity": 10, "min_order_quantity": 1}]
            )
        )

        response = authed_client.patch("/api/v1/listings/listing-1", json={})

        assert response.status_code == 400

    def test_rejects_min_order_exceeding_existing_quantity(self, authed_client, supabase_mock, current_user):
        supabase_mock.table("crops_listings").select.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(
                data=[{"id": "listing-1", "seller_id": current_user["sub"], "quantity": 10, "min_order_quantity": 1}]
            )
        )

        response = authed_client.patch("/api/v1/listings/listing-1", json={"min_order_quantity": 20})

        assert response.status_code == 422

    def test_succeeds_for_owner(self, authed_client, supabase_mock, current_user):
        supabase_mock.table("crops_listings").select.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(
                data=[{"id": "listing-1", "seller_id": current_user["sub"], "quantity": 10, "min_order_quantity": 1}]
            )
        )
        supabase_mock.table("crops_listings").update.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[{"id": "listing-1", "price": 99}])
        )

        response = authed_client.patch("/api/v1/listings/listing-1", json={"price": 99})

        assert response.status_code == 200
        assert response.json()["price"] == 99


class TestDeleteListing:
    def test_404_when_not_found(self, authed_client, supabase_mock):
        supabase_mock.table("crops_listings").select.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[])
        )

        response = authed_client.delete("/api/v1/listings/listing-1")

        assert response.status_code == 404

    def test_forbidden_for_non_owner(self, authed_client, supabase_mock):
        supabase_mock.table("crops_listings").select.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[{"id": "listing-1", "seller_id": "someone-else"}])
        )

        response = authed_client.delete("/api/v1/listings/listing-1")

        assert response.status_code == 403

    def test_succeeds_for_owner(self, authed_client, supabase_mock, current_user):
        supabase_mock.table("crops_listings").select.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[{"id": "listing-1", "seller_id": current_user["sub"]}])
        )

        response = authed_client.delete("/api/v1/listings/listing-1")

        assert response.status_code == 204


class TestCategories:
    def test_returns_sorted_unique_values(self, client, supabase_mock):
        supabase_mock.table("crops_listings").select.return_value.execute.return_value = SimpleNamespace(
            data=[{"category": "Vegetable"}, {"category": "Fruit"}, {"category": "Vegetable"}, {"category": None}]
        )

        response = client.get("/api/v1/listings/categories")

        assert response.status_code == 200
        assert response.json() == ["Fruit", "Vegetable"]

    def test_returns_empty_list_when_no_data(self, client, supabase_mock):
        supabase_mock.table("crops_listings").select.return_value.execute.return_value = SimpleNamespace(data=[])

        response = client.get("/api/v1/listings/categories")

        assert response.status_code == 200
        assert response.json() == []


class TestListingsByCategory:
    def test_returns_matching_listings(self, client, supabase_mock):
        supabase_mock.table(
            "crops_listings"
        ).select.return_value.eq.return_value.eq.return_value.execute.return_value = SimpleNamespace(
            data=[{"id": "1", "category": "Fruit"}]
        )

        response = client.get("/api/v1/listings/category/Fruit")

        assert response.status_code == 200
        assert response.json()[0]["category"] == "Fruit"


class TestAllPrices:
    def test_defaults_to_usd(self, client, supabase_mock):
        supabase_mock.table("price_data").select.return_value.order.return_value.execute.return_value = (
            SimpleNamespace(
                data=[
                    {
                        "crop_id": "c1",
                        "name": "Tomato",
                        "avg_price": 1.005,
                        "min_price": 1.0,
                        "max_price": 2.0,
                        "recorded_at": "2026-06-01",
                        "active_listing_count": 5,
                    }
                ]
            )
        )

        response = client.get("/api/v1/listings/prices")

        assert response.status_code == 200
        assert response.json()[0]["currency"] == "USD"

    def test_converts_to_requested_currency(self, client, supabase_mock):
        supabase_mock.table("price_data").select.return_value.order.return_value.execute.return_value = (
            SimpleNamespace(
                data=[
                    {
                        "crop_id": "c1",
                        "name": "Tomato",
                        "avg_price": 100.0,
                        "min_price": 50.0,
                        "max_price": 150.0,
                        "recorded_at": "2026-06-01",
                        "active_listing_count": 5,
                    }
                ]
            )
        )
        supabase_mock.table(
            "exchange_rate"
        ).select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = (
            SimpleNamespace(data=[{"rate_to_usd": 0.5}])
        )

        response = client.get("/api/v1/listings/prices", params={"currency": "eur"})

        assert response.status_code == 200
        body = response.json()[0]
        assert body["currency"] == "EUR"
        assert body["avg_price"] == 200.0

    def test_404_when_no_price_data(self, client, supabase_mock):
        supabase_mock.table("price_data").select.return_value.order.return_value.execute.return_value = (
            SimpleNamespace(data=[])
        )

        response = client.get("/api/v1/listings/prices")

        assert response.status_code == 404

    def test_404_when_exchange_rate_missing(self, client, supabase_mock):
        supabase_mock.table("price_data").select.return_value.order.return_value.execute.return_value = (
            SimpleNamespace(
                data=[{"crop_id": "c1", "name": "Tomato", "avg_price": 100.0, "min_price": 50.0, "max_price": 150.0}]
            )
        )
        supabase_mock.table(
            "exchange_rate"
        ).select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = (
            SimpleNamespace(data=[])
        )

        response = client.get("/api/v1/listings/prices", params={"currency": "eur"})

        assert response.status_code == 404


class TestPriceHistory:
    def test_returns_empty_when_no_data(self, client, supabase_mock):
        supabase_mock.table(
            "price_data"
        ).select.return_value.eq.return_value.gte.return_value.order.return_value.execute.return_value = (
            SimpleNamespace(data=[])
        )

        response = client.get("/api/v1/listings/prices/c1/history")

        assert response.status_code == 200
        assert response.json() == []

    def test_returns_usd_data_by_default(self, client, supabase_mock):
        supabase_mock.table(
            "price_data"
        ).select.return_value.eq.return_value.gte.return_value.order.return_value.execute.return_value = (
            SimpleNamespace(data=[{"avg_price": 1.0, "min_price": 0.5, "max_price": 1.5, "recorded_at": "2026-06-01"}])
        )

        response = client.get("/api/v1/listings/prices/c1/history")

        assert response.status_code == 200
        assert response.json()[0]["currency"] == "USD"


class TestSingleProducePrice:
    def test_404_when_missing(self, client, supabase_mock):
        supabase_mock.table(
            "price_data"
        ).select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = (
            SimpleNamespace(data=[])
        )

        response = client.get("/api/v1/listings/prices/c1")

        assert response.status_code == 404

    def test_returns_usd_by_default(self, client, supabase_mock):
        supabase_mock.table(
            "price_data"
        ).select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = (
            SimpleNamespace(
                data=[
                    {
                        "avg_price": 1.0,
                        "min_price": 0.5,
                        "max_price": 1.5,
                        "recorded_at": "2026-06-01",
                        "active_listing_count": 3,
                    }
                ]
            )
        )

        response = client.get("/api/v1/listings/prices/c1")

        assert response.status_code == 200
        assert response.json()["currency"] == "USD"


class TestGetListing:
    def test_returns_listing_with_seller_name(self, client, supabase_mock):
        supabase_mock.table(
            "crops_listings"
        ).select.return_value.or_.return_value.limit.return_value.execute.return_value = SimpleNamespace(
            data=[{"id": "listing-1", "seller_id": "user-1"}]
        )
        supabase_mock.table(
            "profiles"
        ).select.return_value.eq.return_value.limit.return_value.execute.return_value = SimpleNamespace(
            data=[{"name": "Farmer Joe"}]
        )

        response = client.get("/api/v1/listings/listing-1")

        assert response.status_code == 200
        assert response.json()["seller_name"] == "Farmer Joe"

    def test_404_when_missing(self, client, supabase_mock):
        supabase_mock.table(
            "crops_listings"
        ).select.return_value.or_.return_value.limit.return_value.execute.return_value = SimpleNamespace(data=[])

        response = client.get("/api/v1/listings/missing-id")

        assert response.status_code == 404
