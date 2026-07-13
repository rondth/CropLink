from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ml.seasonal import make_recommendation

router = APIRouter(prefix="/prices", tags=["prices"])


class RecommendRequest(BaseModel):
    crop_name: str
    category: str
    currency: str = "USD"
    harvest_date: Optional[date] = None


@router.post("/recommend")
def recommend(req: RecommendRequest):
    try:
        return make_recommendation(
            crop_name=req.crop_name,
            category=req.category,
            harvest_date=req.harvest_date,
            currency=req.currency,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
