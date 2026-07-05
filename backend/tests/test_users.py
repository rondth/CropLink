from types import SimpleNamespace


class TestBlockUser:
    def test_rejects_blocking_self(self, authed_client, current_user):
        response = authed_client.post(f"/api/v1/users/{current_user['sub']}/block")

        assert response.status_code == 400

    def test_404_when_target_missing(self, authed_client, supabase_mock):
        supabase_mock.table("profiles").select.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[])
        )

        response = authed_client.post("/api/v1/users/user-999/block")

        assert response.status_code == 404

    def test_409_when_already_blocked(self, authed_client, supabase_mock, current_user):
        supabase_mock.table("profiles").select.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[{"user_id": "user-999"}])
        )
        supabase_mock.table(
            "blocks"
        ).select.return_value.eq.return_value.eq.return_value.execute.return_value = SimpleNamespace(
            data=[{"id": "block-1"}]
        )

        response = authed_client.post("/api/v1/users/user-999/block")

        assert response.status_code == 409

    def test_creates_block(self, authed_client, supabase_mock):
        supabase_mock.table("profiles").select.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[{"user_id": "user-999"}])
        )
        supabase_mock.table(
            "blocks"
        ).select.return_value.eq.return_value.eq.return_value.execute.return_value = SimpleNamespace(data=[])
        supabase_mock.table("blocks").insert.return_value.execute.return_value = SimpleNamespace(
            data=[{"id": "block-1", "blocker_id": "user-123", "blocked_id": "user-999", "created_at": "2026-07-05"}]
        )

        response = authed_client.post("/api/v1/users/user-999/block")

        assert response.status_code == 201
        assert response.json()["blocked_id"] == "user-999"

    def test_requires_authentication(self, client):
        response = client.post("/api/v1/users/user-999/block")

        assert response.status_code == 401


class TestUnblockUser:
    def test_404_when_no_block_exists(self, authed_client, supabase_mock):
        supabase_mock.table(
            "blocks"
        ).select.return_value.eq.return_value.eq.return_value.execute.return_value = SimpleNamespace(data=[])

        response = authed_client.post("/api/v1/users/user-999/unblock")

        assert response.status_code == 404

    def test_succeeds_when_block_exists(self, authed_client, supabase_mock):
        supabase_mock.table(
            "blocks"
        ).select.return_value.eq.return_value.eq.return_value.execute.return_value = SimpleNamespace(
            data=[{"id": "block-1"}]
        )

        response = authed_client.post("/api/v1/users/user-999/unblock")

        assert response.status_code == 204

    def test_requires_authentication(self, client):
        response = client.post("/api/v1/users/user-999/unblock")

        assert response.status_code == 401


class TestReportUser:
    def test_rejects_reporting_self(self, authed_client, current_user):
        response = authed_client.post(
            f"/api/v1/users/{current_user['sub']}/report", json={"reason": "Spamming listings repeatedly"}
        )

        assert response.status_code == 400

    def test_404_when_target_missing(self, authed_client, supabase_mock):
        supabase_mock.table("profiles").select.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[])
        )

        response = authed_client.post(
            "/api/v1/users/user-999/report", json={"reason": "Spamming listings repeatedly"}
        )

        assert response.status_code == 404

    def test_creates_report(self, authed_client, supabase_mock):
        supabase_mock.table("profiles").select.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[{"user_id": "user-999"}])
        )
        supabase_mock.table("reports").insert.return_value.execute.return_value = SimpleNamespace(
            data=[{"id": "report-1"}]
        )

        response = authed_client.post(
            "/api/v1/users/user-999/report", json={"reason": "Spamming listings repeatedly"}
        )

        assert response.status_code == 201
        assert response.json()["id"] == "report-1"

    def test_allows_multiple_reports_without_uniqueness_check(self, authed_client, supabase_mock):
        supabase_mock.table("profiles").select.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[{"user_id": "user-999"}])
        )
        supabase_mock.table("reports").insert.return_value.execute.return_value = SimpleNamespace(
            data=[{"id": "report-2"}]
        )

        response = authed_client.post(
            "/api/v1/users/user-999/report", json={"reason": "Another separate incident"}
        )

        assert response.status_code == 201
        supabase_mock.table("reports").select.assert_not_called()

    def test_rejects_reason_below_min_length(self, authed_client):
        response = authed_client.post("/api/v1/users/user-999/report", json={"reason": "too short"})

        assert response.status_code == 422

    def test_rejects_whitespace_padded_short_reason(self, authed_client):
        response = authed_client.post(
            "/api/v1/users/user-999/report", json={"reason": "   short   "}
        )

        assert response.status_code == 422

    def test_rejects_reason_exceeding_max_length(self, authed_client):
        response = authed_client.post(
            "/api/v1/users/user-999/report", json={"reason": "x" * 501}
        )

        assert response.status_code == 422

    def test_requires_authentication(self, client):
        response = client.post("/api/v1/users/user-999/report", json={"reason": "Spamming listings repeatedly"})

        assert response.status_code == 401


class TestGetBlockedUsers:
    def test_returns_blocked_profiles(self, authed_client, supabase_mock):
        supabase_mock.table("blocks").select.return_value.eq.return_value.execute.return_value = SimpleNamespace(
            data=[
                {
                    "blocked_id": "user-999",
                    "created_at": "2026-07-05",
                    "blocked": {
                        "user_id": "user-999",
                        "name": "Blocked Person",
                        "role": "seller",
                        "profile_picture_url": None,
                    },
                }
            ]
        )

        response = authed_client.get("/api/v1/users/me/blocked")

        assert response.status_code == 200
        body = response.json()
        assert body[0]["user_id"] == "user-999"
        assert body[0]["name"] == "Blocked Person"

    def test_returns_empty_list_when_none_blocked(self, authed_client, supabase_mock):
        supabase_mock.table("blocks").select.return_value.eq.return_value.execute.return_value = SimpleNamespace(
            data=[]
        )

        response = authed_client.get("/api/v1/users/me/blocked")

        assert response.status_code == 200
        assert response.json() == []

    def test_requires_authentication(self, client):
        response = client.get("/api/v1/users/me/blocked")

        assert response.status_code == 401
