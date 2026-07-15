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

def get_blocked_user_ids(supabase, user_id: str) -> set[str]:
    """Return the set of user_ids that are block-related to user_id in either
    direction (user_id blocked them, or they blocked user_id)."""
    blocked_by_user = (
        supabase.table("blocks")
        .select("blocked_id")
        .eq("blocker_id", user_id)
        .eq("status", "active")
        .execute()
    )
    blocked_user = (
        supabase.table("blocks")
        .select("blocker_id")
        .eq("blocked_id", user_id)
        .eq("status", "active")
        .execute()
    )

    ids = {row["blocked_id"] for row in blocked_by_user.data}
    ids.update(row["blocker_id"] for row in blocked_user.data)
    return ids


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

def score_buyer(review_score: float | None, category_match_count: int) -> tuple[float, str]:
    if category_match_count > 0:
        base = review_score if review_score is not None else 2.5
        score = 0.6 * base + 0.4 * min(category_match_count, 5)
        return score, "review_score_and_history"
    return (review_score if review_score is not None else 0.0), "review_score_only"


async def get_subtotal_in_usd(transaction, db) -> float | None:
    currency = transaction.currency or "USD"
    if currency == "USD":
        return float(transaction.total_amount)
    
    rate = await get_rate_to_usd(db, currency, transaction.created_at.date().isoformat())
    if rate is None:
        return None
    return float(transaction.total_amount) * rate
