from types import SimpleNamespace
from unittest.mock import MagicMock


def _mock_blocks_table(supabase_mock, blocked_by_a=None, blockers_of_a=None):
    """Configure the `blocks` table mock for get_blocked_user_ids (two selects,
    keyed by which column is requested), matching the helper in test_messaging.py."""

    def select_side_effect(column):
        query = MagicMock()
        if column == "blocked_id":
            query.eq.return_value.eq.return_value.execute.return_value = SimpleNamespace(data=blocked_by_a or [])
        else:
            query.eq.return_value.eq.return_value.execute.return_value = SimpleNamespace(data=blockers_of_a or [])
        return query

    supabase_mock.table("blocks").select.side_effect = select_side_effect


def _mock_conversations(supabase_mock, data):
    supabase_mock.table(
        "conversations"
    ).select.return_value.or_.return_value.order.return_value.execute.return_value = SimpleNamespace(data=data)


def _convo(convo_id, seller_id, last_message_at, content, read_at, seller_name="Seller"):
    return {
        "id": convo_id,
        "buyer_id": "buyer-1",
        "seller_id": seller_id,
        "last_message_at": last_message_at,
        "listing": {"id": f"listing-{convo_id}", "crop_name": "Tomato", "photo_url": None},
        "buyer": {"user_id": "buyer-1", "name": "Buyer One", "profile_picture_url": None},
        "seller": {"user_id": seller_id, "name": seller_name, "profile_picture_url": None},
        "messages": [
            {"content": content, "created_at": last_message_at, "sender_id": seller_id, "read_at": read_at},
        ],
    }


class TestMessageNotifications:
    def test_requires_authentication(self, client):
        response = client.get("/api/v1/notifications/messages")

        assert response.status_code == 401

    def test_returns_only_unread_conversations_sorted_by_last_message_at_desc(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        _mock_conversations(
            supabase_mock,
            [
                _convo("convo-unread", "seller-1", "2026-07-10T00:00:00Z", "hi there, unread!", None, "Seller One"),
                _convo("convo-read", "seller-2", "2026-07-09T00:00:00Z", "already seen", "2026-07-09T01:00:00Z", "Seller Two"),
            ],
        )
        _mock_blocks_table(supabase_mock)

        response = client.get("/api/v1/notifications/messages")

        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["conversation_id"] == "convo-unread"
        assert body[0]["other_participant"]["name"] == "Seller One"
        assert body[0]["preview"] == "hi there, unread!"
        assert body[0]["unread_count"] == 1
        assert body[0]["last_message_at"] == "2026-07-10T00:00:00Z"

    def test_truncates_preview_to_80_chars(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        _mock_conversations(
            supabase_mock,
            [_convo("convo-1", "seller-1", "2026-07-10T00:00:00Z", "x" * 100, None)],
        )
        _mock_blocks_table(supabase_mock)

        response = client.get("/api/v1/notifications/messages")

        assert response.status_code == 200
        assert response.json()[0]["preview"] == "x" * 80

    def test_excludes_conversations_with_blocked_users(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        _mock_conversations(
            supabase_mock,
            [_convo("convo-1", "blocked-seller", "2026-07-10T00:00:00Z", "hi", None, "Blocked Seller")],
        )
        _mock_blocks_table(supabase_mock, blocked_by_a=[{"blocked_id": "blocked-seller"}])

        response = client.get("/api/v1/notifications/messages")

        assert response.status_code == 200
        assert response.json() == []

    def test_caps_at_ten(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        conversations = [
            _convo(f"convo-{i}", f"seller-{i}", f"2026-06-{i + 1:02d}T00:00:00Z", "hi", None, f"Seller {i}")
            for i in range(12)
        ]
        _mock_conversations(supabase_mock, conversations)
        _mock_blocks_table(supabase_mock)

        response = client.get("/api/v1/notifications/messages")

        assert response.status_code == 200
        assert len(response.json()) == 10
