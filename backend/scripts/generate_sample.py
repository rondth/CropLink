#!/usr/bin/env python3
"""Generate a currency-balanced sample from WFP food price data.

Rules:
- Filter to selected units/currencies/retail/actual.
- For USD rows, require non-empty key location fields.
 - Keep unit filtering, then sample equally across currencies.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate stratified sample CSV.")
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("backend/dataset/wfp_food_prices_global_2026.csv"),
        help="Input CSV path",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("backend/dataset/wfp_food_prices_sample_20.csv"),
        help="Output CSV path",
    )
    parser.add_argument("--n", type=int, default=20, help="Total sample size")
    parser.add_argument("--unit-col", type=str, default="unit", help="Unit column")
    parser.add_argument(
        "--currency-col", type=str, default="currency", help="Currency column"
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    return parser.parse_args()


def preprocess(df: pd.DataFrame, currency_col: str) -> pd.DataFrame:
    df = df[df["unit"].isin(["KG", "1 piece"])].copy()
    df.loc[df["unit"] == "1 piece", "unit"] = "Pcs"

    # Normalize text fields to avoid embedded quote characters in output.
    df["category"] = df["category"].astype(str).str.replace('"', "", regex=False).str.strip()
    df["commodity"] = (
        df["commodity"]
        .astype(str)
        .str.replace('"', "", regex=False)
        .str.replace(",", "", regex=False)
        .str.strip()
    )
    df["category"] = df["category"].replace({"meat, fish and eggs": "meat fish and eggs"})
    df = df[~df["commodity"].str.contains('"', regex=False, na=False)]

    df = df[df[currency_col].isin(["USD", "IDR", "KHR", "LAK", "MMK", "PHP"])]
    df = df[df["pricetype"] == "Retail"]
    df = df[df["priceflag"] == "actual"]

    # For USD rows, require non-empty key fields so we avoid sparse "National Average"-style blanks.
    usd_mask = df[currency_col] == "USD"
    required_for_usd = ["market", "countryiso3", "commodity"]

    good_usd = pd.Series(True, index=df.index)
    for col in required_for_usd:
        good_usd &= df[col].notna() & (df[col].astype(str).str.strip() != "")

    df = df[~usd_mask | good_usd]
    return df


def equal_currency_sample(
    df: pd.DataFrame,
    n_total: int,
    currency_col: str,
    random_state: int,
) -> pd.DataFrame:
    if n_total <= 0:
        raise ValueError("n_total must be > 0")

    missing_cols = [c for c in (currency_col,) if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns: {missing_cols}")

    work = df.reset_index(drop=False).rename(columns={"index": "_row_id"}).copy()
    work = work.dropna(subset=[currency_col])

    cur_sizes = (
        work.groupby(currency_col, as_index=False).size().rename(columns={"size": "N_cur"})
    )
    if len(cur_sizes) == 0:
        raise ValueError("No rows left after filtering.")

    cur_alloc = cur_sizes.copy()
    k = len(cur_alloc)
    base = n_total // k
    extra = n_total % k
    cur_alloc["n_cur"] = base
    if extra > 0:
        idx = cur_alloc.sort_values("N_cur", ascending=False).head(extra).index
        cur_alloc.loc[idx, "n_cur"] += 1

    parts: list[pd.DataFrame] = []
    for _, crow in cur_alloc.iterrows():
        cval = crow[currency_col]
        n_c = int(crow["n_cur"])
        if n_c <= 0:
            continue
        group_c = work[work[currency_col] == cval]
        if len(group_c) == 0:
            continue
        parts.append(group_c.sample(n=min(n_c, len(group_c)), random_state=random_state))

    sample = pd.concat(parts, ignore_index=True) if parts else work.head(0).copy()
    sample = sample.drop_duplicates(subset="_row_id", keep="first")

    missing = n_total - len(sample)
    if missing > 0:
        remaining = work[~work["_row_id"].isin(sample["_row_id"])]
        if len(remaining) >= missing:
            sample = pd.concat(
                [sample, remaining.sample(n=missing, random_state=random_state)],
                ignore_index=True,
            )

    return sample.reset_index(drop=True)


def main() -> None:
    args = parse_args()

    raw = pd.read_csv(args.input)
    filtered = preprocess(raw, currency_col=args.currency_col)

    sampled = equal_currency_sample(
        filtered,
        n_total=args.n,
        currency_col=args.currency_col,
        random_state=args.seed,
    )

    sampled = sampled.drop(columns=["_row_id"], errors="ignore").head(args.n).reset_index(drop=True)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    sampled.to_csv(args.output, index=False)

    print(f"Input: {args.input}")
    print(f"Output: {args.output}")
    print(f"Rows: {len(sampled)}")
    print("Unit distribution:")
    print(sampled[args.unit_col].value_counts())
    print("Currency distribution:")
    print(sampled[args.currency_col].value_counts())


if __name__ == "__main__":
    main()
