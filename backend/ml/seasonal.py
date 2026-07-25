from datetime import date

from ml.predict import CATEGORY_MAP, _load, _load_ref_data, _match_commodity, _predict_price

SHELF_LIFE_DAYS = {
    "highly_perishable": 3,
    "medium_perishable": 14,
    "storable": 90,
}

_CROP_KEYWORDS: list[tuple[str, str]] = [
    ("lettuce",       "highly_perishable"),
    ("spinach",       "highly_perishable"),
    ("herb",          "highly_perishable"),
    ("fish",          "highly_perishable"),
    ("milk",          "highly_perishable"),
    ("dairy",         "highly_perishable"),
    ("yogurt",        "highly_perishable"),
    ("strawberr",     "highly_perishable"),
    ("mushroom",      "highly_perishable"),
    ("berr",          "highly_perishable"),
    ("tomato",        "medium_perishable"),
    ("banana",        "medium_perishable"),
    ("mango",         "medium_perishable"),
    ("papaya",        "medium_perishable"),
    ("eggplant",      "medium_perishable"),
    ("pepper",        "medium_perishable"),
    ("cucumber",      "medium_perishable"),
    ("cabbage",       "medium_perishable"),
    ("carrot",        "medium_perishable"),
    ("onion",         "medium_perishable"),
    ("garlic",        "medium_perishable"),
    ("apple",         "medium_perishable"),
    ("orange",        "medium_perishable"),
    ("lemon",         "medium_perishable"),
    ("potato",        "medium_perishable"),
    ("sweet potato",  "medium_perishable"),
    ("pineapple",     "medium_perishable"),
    ("watermelon",    "medium_perishable"),
    ("meat",          "medium_perishable"),
    ("beef",          "medium_perishable"),
    ("chicken",       "medium_perishable"),
    ("pork",          "medium_perishable"),
    ("egg",           "medium_perishable"),
    ("rice",          "storable"),
    ("wheat",         "storable"),
    ("maize",         "storable"),
    ("corn",          "storable"),
    ("sorghum",       "storable"),
    ("millet",        "storable"),
    ("barley",        "storable"),
    ("flour",         "storable"),
    ("bread",         "storable"),
    ("beans",         "storable"),
    ("lentil",        "storable"),
    ("chickpea",      "storable"),
    ("soybean",       "storable"),
    ("peanut",        "storable"),
    ("groundnut",     "storable"),
    ("cashew",        "storable"),
    ("almond",        "storable"),
    ("nut",           "storable"),
    ("sugar",         "storable"),
    ("salt",          "storable"),
    ("oil",           "storable"),
    ("cassava",       "storable"),
    ("yam",           "storable"),
    ("taro",          "storable"),
    ("dried",         "storable"),
    ("pulse",         "storable"),
    ("dates",         "storable"),
]

_CATEGORY_FALLBACK: dict[str, str] = {
    "cereals and tubers":    "storable",
    "cereals & tubers":      "storable",
    "pulses and nuts":       "storable",
    "pulses & nuts":         "storable",
    "oil and fats":          "storable",
    "oil & fats":            "storable",
    "meat, fish and eggs":   "medium_perishable",
    "meat, fish & eggs":     "medium_perishable",
    "vegetables and fruits": "medium_perishable",
    "vegetables & fruits":   "medium_perishable",
    "miscellaneous food":    "medium_perishable",
}


def get_shelf_life(crop_name: str, category: str) -> tuple[str, int]:
    name = crop_name.lower()
    for keyword, bucket in _CROP_KEYWORDS:
        if keyword in name:
            return bucket, SHELF_LIFE_DAYS[bucket]
    bucket = _CATEGORY_FALLBACK.get(category.lower(), "highly_perishable")
    return bucket, SHELF_LIFE_DAYS[bucket]


def seasonal_forecast(crop_name: str, category: str) -> dict | None:
    artifact = _load()
    model = artifact["model"]
    encoders = artifact["encoders"]
    ref = _load_ref_data()

    matched = _match_commodity(crop_name, ref["known_commodities"])
    if not matched:
        return None

    meta = ref["commodity_meta"][matched]
    category_mapped = CATEGORY_MAP.get(category.lower(), category.lower())

    today = date.today()
    if today.month == 12:
        target_month, target_year = 1, today.year + 1
    else:
        target_month, target_year = today.month + 1, today.year

    base_row = {
        "latitude": meta["latitude"],
        "longitude": meta["longitude"],
        "commodity": matched,
        "category": category_mapped,
        "countryiso3": meta["countryiso3"],
        "currency": meta["currency"],
    }

    current_price = _predict_price(model, encoders, {**base_row, "month": today.month, "year": today.year})
    predicted_price = _predict_price(model, encoders, {**base_row, "month": target_month, "year": target_year})

    return {
        "matched_commodity": matched,
        "current_price_usd": round(current_price, 4),
        "predicted_next_month_usd": round(predicted_price, 4),
        "target_month": target_month,
        "target_year": target_year,
        "confidence": "model",
    }


_UPSIDE_THRESHOLD_PCT = 3.0


def make_recommendation(
    crop_name: str,
    category: str,
    harvest_date: date | None,
    currency: str = "USD",
) -> dict:
    today = date.today()
    bucket, max_safe_days = get_shelf_life(crop_name, category)

    if harvest_date is None:
        return {
            "verdict": "sell_now",
            "reason": "No harvest date provided, defaulting to sell now to avoid spoilage risk.",
            "wait_days_suggested": 0,
            "confidence": "spoilage_override",
            "shelf_life_bucket": bucket,
            "matched_commodity": None,
        }

    days_since_harvest = (today - harvest_date).days
    days_remaining_safe = max_safe_days - days_since_harvest

    # rule 1
    if days_remaining_safe <= 0 or (bucket == "highly_perishable" and days_remaining_safe < 2):
        return {
            "verdict": "sell_now",
            "reason": f"Your crop is at or past its safe storage limit ({max_safe_days} days). Sell immediately to avoid spoilage.",
            "wait_days_suggested": 0,
            "confidence": "spoilage_override",
            "shelf_life_bucket": bucket,
            "matched_commodity": None,
        }

    forecast = seasonal_forecast(crop_name, category)

    if forecast is None:
        return {
            "verdict": "sell_now",
            "reason": f"No market price data found for '{crop_name}'. Defaulting to sell now.",
            "wait_days_suggested": 0,
            "confidence": "no_data",
            "shelf_life_bucket": bucket,
            "matched_commodity": None,
        }

    matched = forecast["matched_commodity"]
    current_price = forecast["current_price_usd"]
    predicted_price = forecast["predicted_next_month_usd"]
    confidence = forecast["confidence"]
    target_month = forecast["target_month"]

    if today.month == 12:
        next_checkpoint = date(today.year + 1, 1, 1)
    else:
        next_checkpoint = date(today.year, today.month + 1, 1)
    days_to_checkpoint = (next_checkpoint - today).days

    # rule 2
    if days_remaining_safe < days_to_checkpoint:
        return {
            "verdict": "sell_now",
            "reason": (
                f"Prices may shift next month, but your crop's storage window closes in "
                f"{days_remaining_safe} day(s) before the next monthly price update. Sell now."
            ),
            "wait_days_suggested": 0,
            "confidence": "spoilage_override",
            "shelf_life_bucket": bucket,
            "matched_commodity": matched,
        }

    # rule 3
    pct_change = (predicted_price - current_price) / current_price * 100 if current_price > 0 else 0.0
    month_name = date(2000, target_month, 1).strftime("%B")

    if pct_change > _UPSIDE_THRESHOLD_PCT:
        wait_days = min(days_to_checkpoint, days_remaining_safe)
        return {
            "verdict": "wait",
            "reason": (
                f"{matched} prices are forecast to rise ~{pct_change:.1f}% in {month_name}. "
                f"You have {days_remaining_safe} safe storage days, enough runway to wait. "
                f"Suggested sell window: within {wait_days} days."
            ),
            "wait_days_suggested": wait_days,
            "confidence": confidence,
            "shelf_life_bucket": bucket,
            "matched_commodity": matched,
        }
    else:
        trend_desc = (
            f"prices are forecast to drop ~{abs(pct_change):.1f}%"
            if pct_change < 0
            else f"no significant price upside expected (~{pct_change:.1f}%)"
        )
        return {
            "verdict": "sell_now",
            "reason": (
                f"{matched}: {trend_desc} next month. "
                f"No strong reason to wait. Sell now to secure current prices."
            ),
            "wait_days_suggested": 0,
            "confidence": confidence,
            "shelf_life_bucket": bucket,
            "matched_commodity": matched,
        }
