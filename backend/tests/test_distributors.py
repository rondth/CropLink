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


def _mock_empty_reviews_and_transactions(supabase_mock):
    supabase_mock.table("user_reviews").select.return_value.in_.return_value.execute.return_value = (
        SimpleNamespace(data=[])
    )
    supabase_mock.table(
        "transaction"
    ).select.return_value.eq.return_value.eq.return_value.in_.return_value.execute.return_value = (
        SimpleNamespace(data=[])
    )


class TestRecommendedDistributors:
    def test_excludes_buyer_who_blocked_seller(self, authed_client, supabase_mock):
        _mock_blocks(supabase_mock, blockers_of_seller=[{"blocker_id": "buyer-blocker"}])
        supabase_mock.table(
            "profiles"
        ).select.return_value.eq.return_value.not_.in_.return_value.execute.return_value = SimpleNamespace(
            data=[{"user_id": "buyer-ok", "name": "OK Buyer", "profile_picture_url": None}]
        )
        _mock_empty_reviews_and_transactions(supabase_mock)

        response = authed_client.get("/api/v1/distributors/recommended")

        assert response.status_code == 200
        body = response.json()
        assert [b["buyer_id"] for b in body] == ["buyer-ok"]
        supabase_mock.table("profiles").select.return_value.eq.return_value.not_.in_.assert_called_once_with(
            "user_id", ["buyer-blocker"]
        )

    def test_no_blocks_behaves_identically_to_before(self, authed_client, supabase_mock):
        _mock_blocks(supabase_mock)
        supabase_mock.table("profiles").select.return_value.eq.return_value.execute.return_value = SimpleNamespace(
            data=[
                {"user_id": "buyer-a", "name": "A", "profile_picture_url": None},
                {"user_id": "buyer-b", "name": "B", "profile_picture_url": None},
            ]
        )
        _mock_empty_reviews_and_transactions(supabase_mock)

        response = authed_client.get("/api/v1/distributors/recommended")

        assert response.status_code == 200
        body = response.json()
        assert {b["buyer_id"] for b in body} == {"buyer-a", "buyer-b"}
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
