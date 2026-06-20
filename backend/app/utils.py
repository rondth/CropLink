from typing import Literal

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
