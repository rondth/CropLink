from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Literal, Optional
from app.core.dependencies import get_current_admin_id
from app.core.supabase import supabase

router = APIRouter(prefix="/admin", tags=["admin"])

# SCHEMAS

class ReportProfile(BaseModel):
    user_id: str
    name: Optional[str] = None
    profile_picture_url: Optional[str] = None


class ReportAdminResponse(BaseModel):
    id: str
    reporter: Optional[ReportProfile] = None
    reported: Optional[ReportProfile] = None
    reason: str
    status: str
    action_taken: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[str] = None
    created_at: Optional[str] = None


class ReportStatusUpdate(BaseModel):
    status: Literal["reviewed", "dismissed", "pending"]
    action_taken: Optional[str] = None

# ENDPOINTS

# GET /admin/reports
@router.get("/reports", response_model=list[ReportAdminResponse])
def list_reports(
    status_filter: Optional[Literal["pending", "reviewed", "dismissed"]] = None,
    _admin_id: str = Depends(get_current_admin_id),
):
    query = (
        supabase.table("reports")
        .select(
            "id, reason, status, action_taken, resolved_by, resolved_at, created_at, "
            "reporter:profiles!reports_reporter_id_fkey(user_id, name, profile_picture_url), "
            "reported:profiles!reports_reported_id_fkey(user_id, name, profile_picture_url)"
        )
        .order("created_at", desc=True)
    )
    if status_filter:
        query = query.eq("status", status_filter)

    response = query.execute()
    return response.data


# PATCH /admin/reports/{report_id}
@router.patch("/reports/{report_id}", response_model=ReportAdminResponse)
def update_report_status(
    report_id: str,
    data: ReportStatusUpdate,
    admin_id: str = Depends(get_current_admin_id),
):
    existing = supabase.table("reports").select("id").eq("id", report_id).execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    update = {
        "status": data.status,
        "action_taken": data.action_taken,
        "resolved_by": admin_id,
        "resolved_at": datetime.now(timezone.utc).isoformat(),
    }
    response = supabase.table("reports").update(update).eq("id", report_id).execute()
    return response.data[0]
