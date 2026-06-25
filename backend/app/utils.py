from typing import Literal
import datetime

PLATFORM_FEE_RATE = 0.02


def calculate_subtotal(price: float, quantity: float) -> float:
    return price * quantity


def calculate_platform_fee(subtotal: float) -> float:
    return round(subtotal * PLATFORM_FEE_RATE, 2)


def calculate_total(price: float, quantity: float) -> float:
    sub = calculate_subtotal(price, quantity)
    fee = calculate_platform_fee(sub)
    return round(sub + fee, 2)


def sort_and_deduplicate(rows: list[dict], sort: Literal["asc", "desc"] = "desc") -> list[dict]:
    rows.sort(key=lambda x: x.get("created_at", ""), reverse=(sort == "desc"))
    seen = set()
    deduped = []
    for t in rows:
        if t["id"] not in seen:
            seen.add(t["id"])
            deduped.append(t)
    return deduped

def get_rate_to_usd(supabase, currency: str) -> float | None:
    result = supabase.table("exchange_rate") \
        .select("rate_to_usd") \
        .eq("currency", currency.upper()) \
        .not_.is_("rate_to_usd", "null") \
        .lte("date", datetime.date.today().isoformat()) \
        .order("date", desc=True) \
        .limit(1) \
        .execute()
    
    if result.data and result.data[0]["rate_to_usd"]:
        return float(result.data[0]["rate_to_usd"])
    return None

async def get_subtotal_in_usd(transaction, db) -> float | None:
    currency = transaction.currency or "USD"
    if currency == "USD":
        return float(transaction.total_amount)
    
    rate = await get_rate_to_usd(db, currency, transaction.created_at.date().isoformat())
    if rate is None:
        return None
    return float(transaction.total_amount) * rate
