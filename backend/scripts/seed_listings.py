import pandas as pd
import requests
import random
from datetime import datetime, timedelta

# ============================================================
# CONFIGURE THESE BEFORE RUNNING
# ============================================================
from pathlib import Path
FASTAPI_BASE_URL = "http://localhost:8000"     
SELLER_EMAIL = "priscilla.a.wijaya@gmail.com"  
SELLER_PASSWORD = "string"                     
CSV_PATH = Path(__file__).resolve().parents[1] / "dataset" / "wfp_food_prices_sample_20.csv"
# ============================================================


def login(email: str, password: str) -> str:
    """Log in and return the JWT access token."""
    resp = requests.post(
        f"{FASTAPI_BASE_URL}/api/v1/auth/login",
        json={"email": email, "password": password}
    )
    if resp.status_code != 200:
        raise Exception(f"Login failed: {resp.status_code} {resp.text}")
    token = resp.json().get("access_token")
    if not token:
        raise Exception(f"No access_token in response: {resp.json()}")
    print(f"✅ Logged in as {email}")
    return token


def load_csv(path: str) -> pd.DataFrame:
    """Load WFP CSV."""
    df = pd.read_csv(path)
    print(f"✅ Loaded {len(df)} usable rows from CSV")
    return df


def map_row_to_listing(row: pd.Series) -> dict:
    """Map a WFP CSV row to your ListingCreate schema."""

    # Map WFP unit to your unit_of_measurement field
    unit_map = {"KG": "kg", "Lbs": "lbs", "Pcs": "pcs"}
    unit = unit_map.get(row["unit"], "kg")

    # Generate a realistic harvested_at date (within last 6 months)
    days_ago = random.randint(7, 180)
    harvested_at = (datetime.utcnow() - timedelta(days=days_ago)).isoformat()

    # Use market + admin1 as location
    location = f"{row['market']}, {row['admin1']}, {row['countryiso3']}"

    # Random but realistic quantity between 50 and 2000
    quantity = round(random.uniform(50, 2000), 1)

    # Min order is 10–20% of quantity
    min_order = round(quantity * random.uniform(0.1, 0.2), 1)

    return {
        "crop_name": row["commodity"],
        "category": row["category"],
        "currency": row["currency"],
        "price": round(float(row["price"]), 2),
        "unit_of_measurement": unit,
        "quantity": quantity,
        "harvested_at": harvested_at,
        "location": location,
        "min_order_quantity": min_order,
        "description": f"{row['commodity']} sourced from {row['market']} market. Category: {row['category']}.",
    }


def seed_listings(token: str, df: pd.DataFrame):
    """POST listings to FastAPI one by one."""
    headers = {"Authorization": f"Bearer {token}"}
    sample = df

    success, failed = 0, 0

    for i, (_, row) in enumerate(sample.iterrows()):
        listing = map_row_to_listing(row)
        try:
            resp = requests.post(
                f"{FASTAPI_BASE_URL}/api/v1/listings/",
                json=listing,
                headers=headers
            )
            if resp.status_code == 201:
                success += 1
                if success % 20 == 0:
                    print(f"  ↳ {success} listings seeded so far...")
            else:
                failed += 1
                print(f"  ⚠️  Row {i} failed ({resp.status_code}): {resp.text[:100]}")
        except Exception as e:
            failed += 1
            print(f"  ❌ Row {i} error: {e}")

    print(f"\n✅ Done! {success} seeded, {failed} failed out of {len(sample)} attempted.")


if __name__ == "__main__":
    token = login(SELLER_EMAIL, SELLER_PASSWORD)
    df = load_csv(CSV_PATH)
    seed_listings(token, df)
