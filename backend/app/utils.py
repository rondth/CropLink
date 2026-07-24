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


def is_blocked_between(supabase, user_a: str, user_b: str) -> bool:
    """Return True if an active block exists between the two users, in either direction."""
    response = (
        supabase.table("blocks")
        .select("id")
        .eq("status", "active")
        .or_(
            f"and(blocker_id.eq.{user_a},blocked_id.eq.{user_b}),"
            f"and(blocker_id.eq.{user_b},blocked_id.eq.{user_a})"
        )
        .limit(1)
        .execute()
    )
    return bool(response.data)


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


ZERO_DECIMAL_CURRENCIES = {"IDR", "LAK", "MMK", "VND"}


def convert_price(
    supabase, amount: float, from_currency: str, to_currency: str, rates_cache: dict[str, float | None]
) -> float | None:
    """Convert `amount` from `from_currency` to `to_currency`, hopping through USD.

    `rates_cache` memoizes each currency's rate_to_usd across calls, so converting
    a batch of rows with a handful of distinct currencies costs at most one
    exchange_rate query per distinct currency, not one per row.
    """
    from_currency = (from_currency or "USD").upper()
    to_currency = to_currency.upper()

    if from_currency == to_currency:
        return amount

    for currency in (from_currency, to_currency):
        if currency not in rates_cache:
            rates_cache[currency] = 1.0 if currency == "USD" else get_rate_to_usd(supabase, currency)

    from_rate = rates_cache[from_currency]
    to_rate = rates_cache[to_currency]
    if from_rate is None or to_rate is None:
        return None

    return (amount * from_rate) / to_rate


def apply_converted_prices(supabase, listings: list[dict], target_currency: str) -> None:
    """Enrich each listing dict in place with `converted_price`/`converted_currency`
    when it can be converted to `target_currency` and differs from the listing's
    own currency. Listings that can't be converted (e.g. missing exchange rate)
    are left untouched rather than failing the whole request."""
    target_currency = target_currency.upper()
    rates_cache: dict[str, float | None] = {}

    for listing in listings:
        price = listing.get("price")
        source_currency = (listing.get("currency") or "USD").upper()
        if price is None or source_currency == target_currency:
            continue

        converted = convert_price(supabase, price, source_currency, target_currency, rates_cache)
        if converted is None:
            continue

        listing["converted_price"] = round(converted) if target_currency in ZERO_DECIMAL_CURRENCIES else round(converted, 2)
        listing["converted_currency"] = target_currency


TRUST_SCORE_NEUTRAL = 2.5
REVIEW_WEIGHT = 0.5
PAYMENT_WEIGHT = 0.3
COMPLETION_WEIGHT = 0.2


def calculate_trust_score(
    review_avg: float | None,
    payment_success_rate: float | None,
    completion_rate: float | None,
) -> float:
    review_component = review_avg if review_avg is not None else TRUST_SCORE_NEUTRAL
    payment_component = (
        payment_success_rate * 5 if payment_success_rate is not None else TRUST_SCORE_NEUTRAL
    )
    completion_component = (
        completion_rate * 5 if completion_rate is not None else TRUST_SCORE_NEUTRAL
    )
    score = (
        REVIEW_WEIGHT * review_component
        + PAYMENT_WEIGHT * payment_component
        + COMPLETION_WEIGHT * completion_component
    )
    return round(score, 2)


def describe_trust_score(
    review_avg: float | None,
    payment_success_rate: float | None,
    completion_rate: float | None,
    review_count: int,
) -> str:
    if review_count == 0 and payment_success_rate is None and completion_rate is None:
        return "New user (no trust history yet)"

    reasons = []
    if review_avg is not None:
        if review_avg >= 4:
            reasons.append(f"Highly rated ({review_avg}★ from {review_count} review{'s' if review_count != 1 else ''})")
        elif review_avg >= 3:
            reasons.append(f"Positively rated ({review_avg}★ from {review_count} review{'s' if review_count != 1 else ''})")
        else:
            reasons.append(f"Mixed reviews ({review_avg}★ from {review_count} review{'s' if review_count != 1 else ''})")

    if payment_success_rate is not None:
        if payment_success_rate >= 0.9:
            reasons.append(f"strong payment history ({round(payment_success_rate * 100)}% successful)")
        elif payment_success_rate >= 0.5:
            reasons.append(f"decent payment history ({round(payment_success_rate * 100)}% successful)")
        else:
            reasons.append(f"inconsistent payment history ({round(payment_success_rate * 100)}% successful)")

    if completion_rate is not None:
        if completion_rate >= 0.9:
            reasons.append(f"reliably completes orders ({round(completion_rate * 100)}%)")
        elif completion_rate >= 0.5:
            reasons.append(f"usually completes orders ({round(completion_rate * 100)}%)")
        else:
            reasons.append(f"often cancels orders ({round(completion_rate * 100)}%)")

    if not reasons:
        return "New user (no trust history yet)"
    return ", ".join(reasons).capitalize()


def recompute_trust_score(supabase, user_id: str) -> float:
    reviews = (
        supabase.table("user_reviews")
        .select("rating")
        .or_(f"buyer_id.eq.{user_id},seller_id.eq.{user_id}")
        .execute()
        .data
    )
    review_avg = round(sum(r["rating"] for r in reviews) / len(reviews), 2) if reviews else None

    payments = (
        supabase.table("payments")
        .select("status, transaction:transaction!inner(buyer_id)")
        .eq("transaction.buyer_id", user_id)
        .in_("status", ["paid", "failed"])
        .execute()
        .data
    )
    payment_success_rate = (
        sum(1 for p in payments if p["status"] == "paid") / len(payments) if payments else None
    )

    transactions = (
        supabase.table("transaction")
        .select("status")
        .or_(f"buyer_id.eq.{user_id},seller_id.eq.{user_id}")
        .in_("status", ["completed", "cancelled"])
        .execute()
        .data
    )
    completion_rate = (
        sum(1 for t in transactions if t["status"] == "completed") / len(transactions)
        if transactions
        else None
    )

    score = calculate_trust_score(review_avg, payment_success_rate, completion_rate)
    basis = describe_trust_score(review_avg, payment_success_rate, completion_rate, len(reviews))
    supabase.table("profiles").update({"trust_score": score, "trust_score_basis": basis}).eq("user_id", user_id).execute()
    return score


async def get_subtotal_in_usd(transaction, db) -> float | None:
    currency = transaction.currency or "USD"
    if currency == "USD":
        return float(transaction.total_amount)
    
    rate = await get_rate_to_usd(db, currency, transaction.created_at.date().isoformat())
    if rate is None:
        return None
    return float(transaction.total_amount) * rate
