from types import SimpleNamespace


def _make_admin(supabase_mock):
    supabase_mock.table("profiles").select.return_value.eq.return_value.execute.return_value = (
        SimpleNamespace(data=[{"is_admin": True}])
    )


class TestAdminGuard:
    def test_rejects_non_admin(self, authed_client, supabase_mock):
        supabase_mock.table("profiles").select.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[{"is_admin": False}])
        )

        response = authed_client.get("/api/v1/admin/reports")

        assert response.status_code == 403

    def test_rejects_when_profile_missing(self, authed_client, supabase_mock):
        supabase_mock.table("profiles").select.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[])
        )

        response = authed_client.get("/api/v1/admin/reports")

        assert response.status_code == 403


class TestListReports:
    def test_lists_reports_for_admin(self, authed_client, supabase_mock):
        _make_admin(supabase_mock)
        supabase_mock.table(
            "reports"
        ).select.return_value.order.return_value.execute.return_value = SimpleNamespace(
            data=[{
                "id": "report-1",
                "reason": "spam listings",
                "status": "pending",
                "action_taken": None,
                "resolved_by": None,
                "resolved_at": None,
                "created_at": "2026-08-01T00:00:00Z",
                "reporter": {"user_id": "user-1", "name": "Alice", "profile_picture_url": None},
                "reported": {"user_id": "user-2", "name": "Bob", "profile_picture_url": None},
            }]
        )

        response = authed_client.get("/api/v1/admin/reports")

        assert response.status_code == 200
        assert response.json()[0]["id"] == "report-1"

    def test_filters_by_status(self, authed_client, supabase_mock):
        _make_admin(supabase_mock)
        supabase_mock.table(
            "reports"
        ).select.return_value.order.return_value.eq.return_value.execute.return_value = SimpleNamespace(data=[])

        response = authed_client.get("/api/v1/admin/reports?status_filter=reviewed")

        assert response.status_code == 200
        supabase_mock.table("reports").select.return_value.order.return_value.eq.assert_called_once_with(
            "status", "reviewed"
        )


class TestUpdateReportStatus:
    def test_404_when_report_missing(self, authed_client, supabase_mock):
        _make_admin(supabase_mock)
        supabase_mock.table("reports").select.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[])
        )

        response = authed_client.patch("/api/v1/admin/reports/report-999", json={"status": "reviewed"})

        assert response.status_code == 404

    def test_reviews_report_and_records_admin(self, authed_client, supabase_mock, current_user):
        _make_admin(supabase_mock)
        supabase_mock.table("reports").select.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[{"id": "report-1"}])
        )
        supabase_mock.table("reports").update.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[{
                "id": "report-1",
                "reason": "spam listings",
                "status": "reviewed",
                "action_taken": "warned user",
                "resolved_by": current_user["sub"],
                "resolved_at": "2026-08-11T00:00:00Z",
                "created_at": "2026-08-01T00:00:00Z",
            }])
        )

        response = authed_client.patch(
            "/api/v1/admin/reports/report-1",
            json={"status": "reviewed", "action_taken": "warned user"},
        )

        assert response.status_code == 200
        update_call = supabase_mock.table("reports").update.call_args[0][0]
        assert update_call["status"] == "reviewed"
        assert update_call["resolved_by"] == current_user["sub"]
        assert "resolved_at" in update_call
