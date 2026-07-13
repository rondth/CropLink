from pathlib import Path
import joblib
import matplotlib.pyplot as plt
import pandas as pd
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBRegressor
DATASET_DIR = Path(__file__).resolve().parents[2] / "backup" / "dataset"
CSV_PATHS = [
    DATASET_DIR / "wfp_food_prices_global_2024.csv",
    DATASET_DIR / "wfp_food_prices_global_2025.csv",
    DATASET_DIR / "wfp_food_prices_global_2026 (1).csv",
]
MODEL_PATH = Path(__file__).resolve().parent / "model.pkl"

CATEGORICAL_COLS = ["commodity", "category", "countryiso3", "currency"]
def load_and_filter() -> pd.DataFrame:
    df = pd.concat([pd.read_csv(p) for p in CSV_PATHS], ignore_index=True)
    df = df[df["unit"].isin(["KG", "Pound", "1 piece"])].copy()
    df.loc[df["unit"] == "Pound", "unit"] = "Lbs"
    df.loc[df["unit"] == "1 piece", "unit"] = "Pcs"
    df = df[df["currency"].isin(["USD", "IDR", "KHR", "LAK", "MMK", "PHP", "SGD", "THB", "VND"])]
    df = df[df["pricetype"] == "Retail"]
    df = df[df["priceflag"] == "actual"]
    df = df.dropna(subset=["usdprice", "commodity", "countryiso3"])
    counts = df["commodity"].value_counts()
    df = df[df["commodity"].isin(counts[counts >= 30].index)]
    return df

def build_features(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, LabelEncoder]]:
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df["month"] = df["date"].dt.month
    df["year"] = df["date"].dt.year

    encoders: dict[str, LabelEncoder] = {}
    for col in CATEGORICAL_COLS:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col].astype(str))
        encoders[col] = le
    return df, encoders

FEATURE_COLS = ["month", "year", "latitude", "longitude", *CATEGORICAL_COLS]
TARGET_COL = 'usdprice'

def train() -> None:
    print("Loading...")
    df = load_and_filter()
    print(f" {len(df):,} rows after filtering")

    df, encoders = build_features(df)
    X = df[FEATURE_COLS]
    y = df[TARGET_COL]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    model = XGBRegressor(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
    )
    print("Training...")
    model.fit(X_train, y_train)
    preds = model.predict(X_test)
    print(f"MAE: {mean_absolute_error(y_test, preds):.4f}")
    print(f"R2: {r2_score(y_test, preds):.4f}")

    comparison = X_test.copy()
    comparison["commodity"] = encoders["commodity"].inverse_transform(comparison["commodity"])
    comparison["actual_price"] = y_test.values
    comparison["predicted_price"] = preds

    train_avg = pd.Series(y_train.values, index=X_train.index)
    commodity_avg = train_avg.groupby(encoders["commodity"].inverse_transform(X_train["commodity"])).mean()
    comparison["historical_avg"] = comparison["commodity"].map(commodity_avg)
    comparison["error"] = comparison["actual_price"] - comparison["predicted_price"]
    
    summary = comparison.groupby("commodity")[["actual_price", "predicted_price", "error", "historical_avg"]].mean()
    print("\nAverage per commodity (actual vs predicted vs historical avg):")
    print(summary.to_string())

    summary["error"].plot(kind="bar", figsize=(16, 5), title="Average Prediction Error per Commodity")
    plt.axhline(0, color="red", linewidth=1)
    plt.ylabel("Error (actual - predicted) in USD")
    plt.tight_layout()
    plt.show()

    joblib.dump({"model": model, "encoders": encoders}, MODEL_PATH)
    print(f"Saved = {MODEL_PATH}")

if __name__ == "__main__":
    train()
