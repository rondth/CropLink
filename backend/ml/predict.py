import json
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import xgboost as xgb

MODEL_PATH = Path(__file__).resolve().parent / "model.json"
ENCODERS_PATH = Path(__file__).resolve().parent / "encoders.json"
REF_DATA_PATH = Path(__file__).resolve().parent / "ref_data.json"

CATEGORY_MAP = {
    "cereals & tubers": "cereals and tubers",
    "meat, fish & eggs": "meat, fish and eggs",
    "oil & fats": "oil and fats",
    "pulses & nuts": "pulses and nuts",
    "vegetables & fruits": "vegetables and fruits",
}

_artifact = None
_ref_data = None


def _load():
    global _artifact
    if _artifact is None:
        booster = xgb.Booster()
        booster.load_model(str(MODEL_PATH))
        encoders = json.loads(ENCODERS_PATH.read_text())
        _artifact = {"model": booster, "encoders": encoders}
    return _artifact


def _load_ref_data():
    global _ref_data
    if _ref_data is None:
        _ref_data = json.loads(REF_DATA_PATH.read_text())
    return _ref_data


def _match_commodity(crop_name: str, known_commodities: list) -> str | None:
    crop_lower = crop_name.lower()
    for commodity in known_commodities:
        if crop_lower in commodity.lower() or commodity.lower().split("(")[0].strip() in crop_lower:
            return commodity
    return None


FEATURE_COLS = ["month", "year", "latitude", "longitude", "commodity", "category", "countryiso3", "currency"]
_CATEGORICAL_COLS = {"commodity", "category", "countryiso3", "currency"}


def _predict_price(model, encoders, row: dict) -> float:
    features = []
    for col in FEATURE_COLS:
        value = row[col]
        if col in _CATEGORICAL_COLS:
            value = encoders[col].get(str(value), 0)
        features.append(value)
    dmatrix = xgb.DMatrix(np.array([features], dtype=np.float32), feature_names=FEATURE_COLS)
    return float(model.predict(dmatrix)[0])


def predict_next_day(commodity, category, countryiso3, currency, latitude, longitude):
    artifact = _load()
    model = artifact["model"]
    encoders = artifact["encoders"]

    tomorrow = date.today() + timedelta(days=1)
    row = {
        "month": tomorrow.month,
        "year": tomorrow.year,
        "latitude": latitude,
        "longitude": longitude,
        "commodity": commodity,
        "category": category,
        "countryiso3": countryiso3,
        "currency": currency,
    }
    predicted_price = _predict_price(model, encoders, row)

    return {
        "date": tomorrow.isoformat(),
        "commodity": commodity,
        "predicted_price": round(predicted_price, 4),
    }


def get_recommendation(crop_name: str, category: str, currency: str) -> dict:
    ref = _load_ref_data()
    artifact = _load()
    model = artifact["model"]
    encoders = artifact["encoders"]

    matched = _match_commodity(crop_name, ref["known_commodities"])
    if not matched:
        return {
            "matched_commodity": None,
            "recommendation": None,
            "reason": f"No market data found for '{crop_name}'.",
            "predicted_usd_price": None,
            "historical_avg_usd": None,
        }

    meta = ref["commodity_meta"][matched]
    hist_avg = ref["hist_avg"][matched]
    category_mapped = CATEGORY_MAP.get(category.lower(), category.lower())
    currency_to_use = currency if currency in encoders["currency"] else meta["currency"]

    base_row = {
        "latitude": meta["latitude"],
        "longitude": meta["longitude"],
        "commodity": matched,
        "category": category_mapped,
        "countryiso3": meta["countryiso3"],
        "currency": currency_to_use,
    }

    today = date.today()
    tomorrow = today + timedelta(days=1)
    day_after = today + timedelta(days=2)

    price_today = _predict_price(model, encoders, {**base_row, "month": today.month, "year": today.year})
    price_tomorrow = _predict_price(model, encoders, {**base_row, "month": tomorrow.month, "year": tomorrow.year})
    price_day_after = _predict_price(model, encoders, {**base_row, "month": day_after.month, "year": day_after.year})

    # Determine best sell window within 2 days (crops perish fast)
    prices = {
        "today": price_today,
        "tomorrow": price_tomorrow,
        "in 2 days": price_day_after,
    }
    best_day = max(prices, key=lambda k: prices[k])
    best_price = prices[best_day]

    if best_day == "today" or best_price <= price_today * 1.02:
        recommendation = "Sell Now"
        reason = f"Prices are at their best right now (${price_today:.2f}/kg USD avg). No meaningful gain from waiting. Sell before your crop loses freshness."
    else:
        recommendation = f"Wait {best_day}"
        gain = ((best_price - price_today) / price_today) * 100
        reason = f"Prices are expected to be slightly higher {best_day} (${best_price:.2f}/kg vs ${price_today:.2f}/kg USD avg, ~{gain:.1f}% gain). Sell within 2 days to avoid spoilage."

    return {
        "matched_commodity": matched,
        "predicted_usd_price": round(price_today, 4),
        "historical_avg_usd": round(hist_avg, 4),
        "recommendation": recommendation,
        "reason": reason,
    }


if __name__ == "__main__":
    result = predict_next_day("Bread", "cereals and tubers", "IDN", "USD", 14.5995, 120.9842)
    print(result)