from datetime import date, timedelta

from ml.seasonal import get_shelf_life, make_recommendation


class TestGetShelfLife:
    def test_matches_crop_keyword_case_insensitively(self):
        assert get_shelf_life("Lettuce", "Vegetables & Fruits") == ("highly_perishable", 3)

    def test_matches_keyword_as_substring(self):
        assert get_shelf_life("Ground Beef Patties", "Meat, Fish & Eggs") == ("medium_perishable", 14)

    def test_falls_back_to_category_when_no_keyword_matches(self):
        assert get_shelf_life("Unknown Widget Crop", "Cereals & Tubers") == ("storable", 90)

    def test_falls_back_to_highly_perishable_when_category_unmapped(self):
        assert get_shelf_life("Unknown Widget Crop", "Some Unmapped Category") == ("highly_perishable", 3)


class TestMakeRecommendation:
    def test_no_harvest_date_defaults_to_sell_now(self):
        result = make_recommendation("Lettuce", "Vegetables & Fruits", harvest_date=None)

        assert result["verdict"] == "sell_now"
        assert result["confidence"] == "spoilage_override"
        assert result["wait_days_suggested"] == 0
        assert result["matched_commodity"] is None

    def test_past_safe_storage_window_sells_now(self):
        harvest_date = date.today() - timedelta(days=10)

        result = make_recommendation("Lettuce", "Vegetables & Fruits", harvest_date=harvest_date)

        assert result["verdict"] == "sell_now"
        assert result["confidence"] == "spoilage_override"
        assert "past its safe storage limit" in result["reason"]

    def test_highly_perishable_with_less_than_two_safe_days_sells_now(self):
        harvest_date = date.today() - timedelta(days=2)

        result = make_recommendation("Lettuce", "Vegetables & Fruits", harvest_date=harvest_date)

        assert result["verdict"] == "sell_now"
        assert result["confidence"] == "spoilage_override"

    def test_no_market_data_defaults_to_sell_now(self, monkeypatch):
        monkeypatch.setattr("ml.seasonal.seasonal_forecast", lambda crop_name, category: None)
        harvest_date = date.today() - timedelta(days=1)

        result = make_recommendation("Rice", "Cereals & Tubers", harvest_date=harvest_date)

        assert result["verdict"] == "sell_now"
        assert result["confidence"] == "no_data"
        assert result["matched_commodity"] is None

    def test_sells_now_when_storage_window_closes_before_next_checkpoint(self, monkeypatch):
        monkeypatch.setattr(
            "ml.seasonal.seasonal_forecast",
            lambda crop_name, category: {
                "matched_commodity": "Rice",
                "current_price_usd": 1.0,
                "predicted_next_month_usd": 2.0,
                "target_month": 1,
                "confidence": "model",
            },
        )
        harvest_date = date.today() - timedelta(days=13)

        result = make_recommendation("Onion", "Vegetables & Fruits", harvest_date=harvest_date)

        assert result["verdict"] == "sell_now"
        assert result["confidence"] == "spoilage_override"
        assert result["matched_commodity"] == "Rice"

    def test_recommends_wait_when_price_upside_exceeds_threshold(self, monkeypatch):
        monkeypatch.setattr(
            "ml.seasonal.seasonal_forecast",
            lambda crop_name, category: {
                "matched_commodity": "Rice",
                "current_price_usd": 1.00,
                "predicted_next_month_usd": 1.10,
                "target_month": (date.today().month % 12) + 1,
                "confidence": "model",
            },
        )

        result = make_recommendation("Rice", "Cereals & Tubers", harvest_date=date.today())

        assert result["verdict"] == "wait"
        assert result["confidence"] == "model"
        assert result["wait_days_suggested"] > 0
        assert "Rice" in result["reason"]

    def test_sells_now_when_price_upside_below_threshold(self, monkeypatch):
        monkeypatch.setattr(
            "ml.seasonal.seasonal_forecast",
            lambda crop_name, category: {
                "matched_commodity": "Rice",
                "current_price_usd": 1.00,
                "predicted_next_month_usd": 1.01,
                "target_month": (date.today().month % 12) + 1,
                "confidence": "model",
            },
        )

        result = make_recommendation("Rice", "Cereals & Tubers", harvest_date=date.today())

        assert result["verdict"] == "sell_now"
        assert result["wait_days_suggested"] == 0
        assert "no significant price upside" in result["reason"]

    def test_sells_now_when_price_forecast_to_drop(self, monkeypatch):
        monkeypatch.setattr(
            "ml.seasonal.seasonal_forecast",
            lambda crop_name, category: {
                "matched_commodity": "Rice",
                "current_price_usd": 1.00,
                "predicted_next_month_usd": 0.90,
                "target_month": (date.today().month % 12) + 1,
                "confidence": "model",
            },
        )

        result = make_recommendation("Rice", "Cereals & Tubers", harvest_date=date.today())

        assert result["verdict"] == "sell_now"
        assert "forecast to drop" in result["reason"]


class TestRecommendEndpoint:
    def test_returns_recommendation_payload(self, client, monkeypatch):
        monkeypatch.setattr(
            "app.api.v1.recommend.make_recommendation",
            lambda crop_name, category, harvest_date, currency: {
                "verdict": "sell_now",
                "reason": "stubbed",
                "wait_days_suggested": 0,
                "confidence": "spoilage_override",
                "shelf_life_bucket": "storable",
                "matched_commodity": None,
            },
        )

        response = client.post(
            "/api/v1/prices/recommend",
            json={"crop_name": "Rice", "category": "Cereals & Tubers"},
        )

        assert response.status_code == 200
        assert response.json()["verdict"] == "sell_now"

    def test_defaults_currency_to_usd_and_harvest_date_to_none(self, monkeypatch, client):
        captured = {}

        def fake_recommendation(crop_name, category, harvest_date, currency):
            captured["currency"] = currency
            captured["harvest_date"] = harvest_date
            return {
                "verdict": "sell_now",
                "reason": "stubbed",
                "wait_days_suggested": 0,
                "confidence": "spoilage_override",
                "shelf_life_bucket": "storable",
                "matched_commodity": None,
            }

        monkeypatch.setattr("app.api.v1.recommend.make_recommendation", fake_recommendation)

        response = client.post(
            "/api/v1/prices/recommend",
            json={"crop_name": "Rice", "category": "Cereals & Tubers"},
        )

        assert response.status_code == 200
        assert captured["currency"] == "USD"
        assert captured["harvest_date"] is None

    def test_500_when_recommendation_raises(self, client, monkeypatch):
        def boom(crop_name, category, harvest_date, currency):
            raise RuntimeError("model unavailable")

        monkeypatch.setattr("app.api.v1.recommend.make_recommendation", boom)

        response = client.post(
            "/api/v1/prices/recommend",
            json={"crop_name": "Rice", "category": "Cereals & Tubers"},
        )

        assert response.status_code == 500
        assert response.json()["detail"] == "model unavailable"

    def test_422_when_required_fields_missing(self, client):
        response = client.post("/api/v1/prices/recommend", json={})

        assert response.status_code == 422

    def test_does_not_require_authentication(self, client, monkeypatch):
        monkeypatch.setattr(
            "app.api.v1.recommend.make_recommendation",
            lambda crop_name, category, harvest_date, currency: {
                "verdict": "sell_now",
                "reason": "stubbed",
                "wait_days_suggested": 0,
                "confidence": "spoilage_override",
                "shelf_life_bucket": "storable",
                "matched_commodity": None,
            },
        )

        response = client.post(
            "/api/v1/prices/recommend",
            json={"crop_name": "Rice", "category": "Cereals & Tubers"},
        )

        assert response.status_code == 200
