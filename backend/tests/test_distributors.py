from types import SimpleNamespace


def _mock_blocks(supabase_mock, blocked_by_seller=None, blockers_of_seller=None):
    """get_blocked_user_ids issues two selects against `blocks` (both using the
    same select().eq().eq().execute() chain), so we distinguish them by call
    order via side_effect: first call is "who the seller blocked", second is
    "who blocked the seller"."""
    supabase_mock.table("blocks").select.return_value.eq.return_value.eq.return_value.execute.side_effect = [
        SimpleNamespace(data=blocked_by_seller or []),
        SimpleNamespace(data=blockers_of_seller or []),
    ]


class TestRecommendedDistributors:
    def test_excludes_buyer_who_blocked_seller(self, authed_client, supabase_mock):
        _mock_blocks(supabase_mock, blockers_of_seller=[{"blocker_id": "buyer-blocker"}])
        supabase_mock.table(
            "profiles"
        ).select.return_value.eq.return_value.not_.in_.return_value.execute.return_value = SimpleNamespace(
            data=[{"user_id": "buyer-ok", "name": "OK Buyer", "profile_picture_url": None, "trust_score": 3.0}]
        )

        response = authed_client.get("/api/v1/distributors/recommended")

        assert response.status_code == 200
        body = response.json()
        assert [b["buyer_id"] for b in body] == ["buyer-ok"]
        supabase_mock.table("profiles").select.return_value.eq.return_value.not_.in_.assert_called_once_with(
            "user_id", ["buyer-blocker"]
        )

    def test_ranks_buyers_by_trust_score_descending(self, authed_client, supabase_mock):
        _mock_blocks(supabase_mock)
        supabase_mock.table("profiles").select.return_value.eq.return_value.execute.return_value = SimpleNamespace(
            data=[
                {"user_id": "buyer-a", "name": "A", "profile_picture_url": None, "trust_score": 2.1, "trust_score_basis": "Mixed reviews"},
                {"user_id": "buyer-b", "name": "B", "profile_picture_url": None, "trust_score": 4.8, "trust_score_basis": "Highly rated; strong payment history"},
            ]
        )

        response = authed_client.get("/api/v1/distributors/recommended")

        assert response.status_code == 200
        body = response.json()
        assert [b["buyer_id"] for b in body] == ["buyer-b", "buyer-a"]
        assert [b["trust_score"] for b in body] == [4.8, 2.1]
        assert body[0]["trust_score_basis"] == "Highly rated; strong payment history"
        supabase_mock.table("profiles").select.return_value.eq.return_value.not_.in_.assert_not_called()

    def test_returns_empty_list_when_all_eligible_buyers_blocked(self, authed_client, supabase_mock):
        _mock_blocks(
            supabase_mock,
            blockers_of_seller=[{"blocker_id": "buyer-a"}, {"blocker_id": "buyer-b"}],
        )
        supabase_mock.table(
            "profiles"
        ).select.return_value.eq.return_value.not_.in_.return_value.execute.return_value = SimpleNamespace(
            data=[]
        )

        response = authed_client.get("/api/v1/distributors/recommended")

        assert response.status_code == 200
        assert response.json() == []

    def test_only_sellers_can_view_recommendations(self, authed_as):
        client = authed_as(role="buyer")

        response = client.get("/api/v1/distributors/recommended")

        assert response.status_code == 403

    def test_requires_authentication(self, client):
        response = client.get("/api/v1/distributors/recommended")

        assert response.status_code == 401
