from types import SimpleNamespace
from unittest.mock import MagicMock


def _mock_blocks_table(supabase_mock, blocked_by_a=None, blockers_of_a=None):
    """Configure the `blocks` table mock for get_blocked_user_ids (two selects,
    keyed by which column is requested), matching the helper in test_listings.py."""

    def select_side_effect(column):
        query = MagicMock()
        if column == "blocked_id":
            query.eq.return_value.eq.return_value.execute.return_value = SimpleNamespace(data=blocked_by_a or [])
        else:
            query.eq.return_value.eq.return_value.execute.return_value = SimpleNamespace(data=blockers_of_a or [])
        return query

    supabase_mock.table("blocks").select.side_effect = select_side_effect


def _mock_no_active_block(supabase_mock):
    supabase_mock.table("blocks").select.return_value.eq.return_value.or_.return_value.limit.return_value.execute.return_value = (
        SimpleNamespace(data=[])
    )


def _mock_active_block(supabase_mock):
    supabase_mock.table("blocks").select.return_value.eq.return_value.or_.return_value.limit.return_value.execute.return_value = (
        SimpleNamespace(data=[{"id": "block-1"}])
    )


def _mock_listing(supabase_mock, listing_id="listing-1", seller_id="seller-1"):
    supabase_mock.table("crops_listings").select.return_value.eq.return_value.execute.return_value = SimpleNamespace(
        data=[{"id": listing_id, "seller_id": seller_id, "crop_name": "Tomato", "photo_url": None}]
    )


def _mock_existing_conversation(supabase_mock, data):
    supabase_mock.table(
        "conversations"
    ).select.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value = SimpleNamespace(data=data)


def _mock_conversation_lookup(supabase_mock, conversation):
    supabase_mock.table("conversations").select.return_value.eq.return_value.execute.return_value = SimpleNamespace(
        data=[conversation] if conversation else []
    )


class TestCreateConversation:
    def test_requires_authentication(self, client):
        response = client.post("/api/v1/conversations/", json={"listing_id": "listing-1"})

        assert response.status_code == 401

    def test_404_when_listing_missing(self, authed_client, supabase_mock):
        supabase_mock.table("crops_listings").select.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[])
        )

        response = authed_client.post("/api/v1/conversations/", json={"listing_id": "missing"})

        assert response.status_code == 404

    def test_seller_cannot_message_own_listing(self, authed_as, supabase_mock):
        client = authed_as(user_id="seller-1")
        _mock_listing(supabase_mock, seller_id="seller-1")

        response = client.post("/api/v1/conversations/", json={"listing_id": "listing-1"})

        assert response.status_code == 400

    def test_403_when_buyer_blocked_seller(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        _mock_listing(supabase_mock, seller_id="seller-1")
        _mock_active_block(supabase_mock)

        response = client.post("/api/v1/conversations/", json={"listing_id": "listing-1"})

        assert response.status_code == 403

    def test_403_when_seller_blocked_buyer(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        _mock_listing(supabase_mock, seller_id="seller-1")
        _mock_active_block(supabase_mock)

        response = client.post("/api/v1/conversations/", json={"listing_id": "listing-1"})

        assert response.status_code == 403

    def test_creates_new_conversation_when_none_exists(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        _mock_listing(supabase_mock, seller_id="seller-1")
        _mock_no_active_block(supabase_mock)
        _mock_existing_conversation(supabase_mock, [])
        supabase_mock.table("conversations").insert.return_value.execute.return_value = SimpleNamespace(
            data=[{"id": "convo-1", "listing_id": "listing-1", "buyer_id": "buyer-1", "seller_id": "seller-1"}]
        )

        response = client.post("/api/v1/conversations/", json={"listing_id": "listing-1"})

        assert response.status_code == 201
        assert response.json()["id"] == "convo-1"

    def test_returns_existing_conversation_idempotently(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        _mock_listing(supabase_mock, seller_id="seller-1")
        _mock_no_active_block(supabase_mock)
        _mock_existing_conversation(
            supabase_mock,
            [{"id": "convo-existing", "listing_id": "listing-1", "buyer_id": "buyer-1", "seller_id": "seller-1"}],
        )

        response = client.post("/api/v1/conversations/", json={"listing_id": "listing-1"})

        assert response.status_code == 200
        assert response.json()["id"] == "convo-existing"
        supabase_mock.table("conversations").insert.assert_not_called()


class TestListConversations:
    def test_requires_authentication(self, client):
        response = client.get("/api/v1/conversations/")

        assert response.status_code == 401

    def test_returns_other_participant_preview_and_unread_count(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        supabase_mock.table(
            "conversations"
        ).select.return_value.or_.return_value.order.return_value.execute.return_value = SimpleNamespace(
            data=[
                {
                    "id": "convo-1",
                    "buyer_id": "buyer-1",
                    "seller_id": "seller-1",
                    "listing": {"id": "listing-1", "crop_name": "Tomato", "photo_url": None},
                    "buyer": {"user_id": "buyer-1", "name": "Buyer One", "profile_picture_url": None},
                    "seller": {"user_id": "seller-1", "name": "Seller One", "profile_picture_url": None},
                    "messages": [
                        {
                            "content": "x" * 100,
                            "created_at": "2026-07-01T00:00:00Z",
                            "sender_id": "seller-1",
                            "read_at": None,
                        },
                        {
                            "content": "earlier",
                            "created_at": "2026-06-01T00:00:00Z",
                            "sender_id": "seller-1",
                            "read_at": "2026-06-02T00:00:00Z",
                        },
                    ],
                }
            ]
        )
        _mock_blocks_table(supabase_mock)

        response = client.get("/api/v1/conversations/")

        assert response.status_code == 200
        body = response.json()[0]
        assert body["other_participant"]["user_id"] == "seller-1"
        assert body["last_message"]["content"] == "x" * 80
        assert body["unread_count"] == 1

    def test_excludes_conversations_with_blocked_users(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        supabase_mock.table(
            "conversations"
        ).select.return_value.or_.return_value.order.return_value.execute.return_value = SimpleNamespace(
            data=[
                {
                    "id": "convo-1",
                    "buyer_id": "buyer-1",
                    "seller_id": "blocked-seller",
                    "listing": {"id": "listing-1", "crop_name": "Tomato", "photo_url": None},
                    "buyer": {"user_id": "buyer-1", "name": "Buyer One", "profile_picture_url": None},
                    "seller": {"user_id": "blocked-seller", "name": "Blocked Seller", "profile_picture_url": None},
                    "messages": [
                        {
                            "content": "hi",
                            "created_at": "2026-07-01T00:00:00Z",
                            "sender_id": "blocked-seller",
                            "read_at": None,
                        }
                    ],
                }
            ]
        )
        _mock_blocks_table(supabase_mock, blocked_by_a=[{"blocked_id": "blocked-seller"}])

        response = client.get("/api/v1/conversations/")

        assert response.status_code == 200
        assert response.json() == []

    def test_excludes_conversations_with_no_messages_yet(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        supabase_mock.table(
            "conversations"
        ).select.return_value.or_.return_value.order.return_value.execute.return_value = SimpleNamespace(
            data=[
                {
                    "id": "convo-1",
                    "buyer_id": "buyer-1",
                    "seller_id": "seller-1",
                    "listing": {"id": "listing-1", "crop_name": "Tomato", "photo_url": None},
                    "buyer": {"user_id": "buyer-1", "name": "Buyer One", "profile_picture_url": None},
                    "seller": {"user_id": "seller-1", "name": "Seller One", "profile_picture_url": None},
                    "messages": [],
                }
            ]
        )
        _mock_blocks_table(supabase_mock)

        response = client.get("/api/v1/conversations/")

        assert response.status_code == 200
        assert response.json() == []


class TestGetConversation:
    def test_requires_authentication(self, client):
        response = client.get("/api/v1/conversations/convo-1")

        assert response.status_code == 401

    def test_404_when_conversation_missing(self, authed_client, supabase_mock):
        _mock_conversation_lookup(supabase_mock, None)

        response = authed_client.get("/api/v1/conversations/convo-1")

        assert response.status_code == 404

    def test_403_when_not_participant(self, authed_as, supabase_mock):
        client = authed_as(user_id="stranger")
        _mock_conversation_lookup(
            supabase_mock, {"id": "convo-1", "buyer_id": "buyer-1", "seller_id": "seller-1"}
        )

        response = client.get("/api/v1/conversations/convo-1")

        assert response.status_code == 403

    def test_returns_conversation_detail_for_participant(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        _mock_conversation_lookup(
            supabase_mock,
            {
                "id": "convo-1",
                "buyer_id": "buyer-1",
                "seller_id": "seller-1",
                "listing": {"id": "listing-1", "crop_name": "Tomato", "photo_url": None},
                "buyer": {"user_id": "buyer-1", "name": "Buyer One", "profile_picture_url": None},
                "seller": {"user_id": "seller-1", "name": "Seller One", "profile_picture_url": None},
            },
        )

        response = client.get("/api/v1/conversations/convo-1")

        assert response.status_code == 200
        body = response.json()
        assert body["id"] == "convo-1"
        assert body["other_participant"]["user_id"] == "seller-1"
        assert body["listing"]["crop_name"] == "Tomato"

    def test_returns_buyer_as_other_participant_when_seller_views(self, authed_as, supabase_mock):
        client = authed_as(user_id="seller-1")
        _mock_conversation_lookup(
            supabase_mock,
            {
                "id": "convo-1",
                "buyer_id": "buyer-1",
                "seller_id": "seller-1",
                "listing": {"id": "listing-1", "crop_name": "Tomato", "photo_url": None},
                "buyer": {"user_id": "buyer-1", "name": "Buyer One", "profile_picture_url": None},
                "seller": {"user_id": "seller-1", "name": "Seller One", "profile_picture_url": None},
            },
        )

        response = client.get("/api/v1/conversations/convo-1")

        assert response.status_code == 200
        assert response.json()["other_participant"]["user_id"] == "buyer-1"


class TestGetMessages:
    def test_requires_authentication(self, client):
        response = client.get("/api/v1/conversations/convo-1/messages")

        assert response.status_code == 401

    def test_404_when_conversation_missing(self, authed_client, supabase_mock):
        _mock_conversation_lookup(supabase_mock, None)

        response = authed_client.get("/api/v1/conversations/convo-1/messages")

        assert response.status_code == 404

    def test_403_when_not_participant(self, authed_as, supabase_mock):
        client = authed_as(user_id="stranger")
        _mock_conversation_lookup(
            supabase_mock, {"id": "convo-1", "buyer_id": "buyer-1", "seller_id": "seller-1"}
        )

        response = client.get("/api/v1/conversations/convo-1/messages")

        assert response.status_code == 403

    def test_returns_messages_for_participant(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        _mock_conversation_lookup(
            supabase_mock, {"id": "convo-1", "buyer_id": "buyer-1", "seller_id": "seller-1"}
        )
        supabase_mock.table(
            "messages"
        ).select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = (
            SimpleNamespace(data=[{"id": "msg-1", "content": "hi", "sender_id": "seller-1"}])
        )

        response = client.get("/api/v1/conversations/convo-1/messages")

        assert response.status_code == 200
        assert response.json()[0]["id"] == "msg-1"

    def test_rejects_limit_over_max(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        _mock_conversation_lookup(
            supabase_mock, {"id": "convo-1", "buyer_id": "buyer-1", "seller_id": "seller-1"}
        )

        response = client.get("/api/v1/conversations/convo-1/messages", params={"limit": 101})

        assert response.status_code == 422

    def test_applies_before_cursor(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        _mock_conversation_lookup(
            supabase_mock, {"id": "convo-1", "buyer_id": "buyer-1", "seller_id": "seller-1"}
        )
        supabase_mock.table(
            "messages"
        ).select.return_value.eq.return_value.order.return_value.limit.return_value.lt.return_value.execute.return_value = (
            SimpleNamespace(data=[{"id": "msg-0", "content": "older"}])
        )

        response = client.get(
            "/api/v1/conversations/convo-1/messages", params={"before": "2026-07-01T00:00:00Z"}
        )

        assert response.status_code == 200
        assert response.json()[0]["id"] == "msg-0"


class TestSendMessage:
    def test_requires_authentication(self, client):
        response = client.post("/api/v1/conversations/convo-1/messages", json={"content": "hi"})

        assert response.status_code == 401

    def test_404_when_conversation_missing(self, authed_client, supabase_mock):
        _mock_conversation_lookup(supabase_mock, None)

        response = authed_client.post("/api/v1/conversations/convo-1/messages", json={"content": "hi"})

        assert response.status_code == 404

    def test_403_when_not_participant(self, authed_as, supabase_mock):
        client = authed_as(user_id="stranger")
        _mock_conversation_lookup(
            supabase_mock, {"id": "convo-1", "buyer_id": "buyer-1", "seller_id": "seller-1"}
        )

        response = client.post("/api/v1/conversations/convo-1/messages", json={"content": "hi"})

        assert response.status_code == 403

    def test_403_when_blocked_in_either_direction(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        _mock_conversation_lookup(
            supabase_mock, {"id": "convo-1", "buyer_id": "buyer-1", "seller_id": "seller-1"}
        )
        _mock_active_block(supabase_mock)

        response = client.post("/api/v1/conversations/convo-1/messages", json={"content": "hi"})

        assert response.status_code == 403

    def test_creates_message_and_updates_last_message_at(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        _mock_conversation_lookup(
            supabase_mock, {"id": "convo-1", "buyer_id": "buyer-1", "seller_id": "seller-1"}
        )
        _mock_no_active_block(supabase_mock)
        supabase_mock.table("messages").insert.return_value.execute.return_value = SimpleNamespace(
            data=[{"id": "msg-1", "content": "hi", "sender_id": "buyer-1", "conversation_id": "convo-1"}]
        )

        response = client.post("/api/v1/conversations/convo-1/messages", json={"content": "hi"})

        assert response.status_code == 201
        assert response.json()["id"] == "msg-1"
        supabase_mock.table("conversations").update.assert_called_once()
        supabase_mock.table("conversations").update.return_value.eq.assert_called_once_with("id", "convo-1")


class TestMessageContentValidation:
    def test_rejects_empty_content(self, authed_client):
        response = authed_client.post("/api/v1/conversations/convo-1/messages", json={"content": ""})

        assert response.status_code == 422

    def test_rejects_whitespace_only_content(self, authed_client):
        response = authed_client.post("/api/v1/conversations/convo-1/messages", json={"content": "   "})

        assert response.status_code == 422

    def test_rejects_content_over_max_length(self, authed_client):
        response = authed_client.post(
            "/api/v1/conversations/convo-1/messages", json={"content": "x" * 2001}
        )

        assert response.status_code == 422

    def test_accepts_content_at_max_length(self, authed_client, supabase_mock):
        _mock_conversation_lookup(
            supabase_mock, {"id": "convo-1", "buyer_id": "user-123", "seller_id": "seller-1"}
        )
        _mock_no_active_block(supabase_mock)
        supabase_mock.table("messages").insert.return_value.execute.return_value = SimpleNamespace(
            data=[{"id": "msg-1", "content": "x" * 2000}]
        )

        response = authed_client.post(
            "/api/v1/conversations/convo-1/messages", json={"content": "x" * 2000}
        )

        assert response.status_code == 201


class TestMarkConversationRead:
    def _mock_update_result(self, supabase_mock, rows):
        supabase_mock.table(
            "messages"
        ).update.return_value.eq.return_value.neq.return_value.is_.return_value.execute.return_value = (
            SimpleNamespace(data=rows)
        )

    def test_requires_authentication(self, client):
        response = client.patch("/api/v1/conversations/convo-1/read")

        assert response.status_code == 401

    def test_404_when_conversation_missing(self, authed_client, supabase_mock):
        _mock_conversation_lookup(supabase_mock, None)

        response = authed_client.patch("/api/v1/conversations/convo-1/read")

        assert response.status_code == 404

    def test_403_when_not_participant(self, authed_as, supabase_mock):
        client = authed_as(user_id="stranger")
        _mock_conversation_lookup(
            supabase_mock, {"id": "convo-1", "buyer_id": "buyer-1", "seller_id": "seller-1"}
        )

        response = client.patch("/api/v1/conversations/convo-1/read")

        assert response.status_code == 403

    def test_marks_only_messages_from_other_participant_as_read(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        _mock_conversation_lookup(
            supabase_mock, {"id": "convo-1", "buyer_id": "buyer-1", "seller_id": "seller-1"}
        )
        self._mock_update_result(supabase_mock, [{"id": "msg-1"}, {"id": "msg-2"}])

        response = client.patch("/api/v1/conversations/convo-1/read")

        assert response.status_code == 200
        assert response.json() == {"marked_count": 2}

        update_call = supabase_mock.table("messages").update
        update_call.return_value.eq.assert_called_once_with("conversation_id", "convo-1")
        update_call.return_value.eq.return_value.neq.assert_called_once_with("sender_id", "buyer-1")
        update_call.return_value.eq.return_value.neq.return_value.is_.assert_called_once_with("read_at", None)

    def test_idempotent_when_called_twice(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        _mock_conversation_lookup(
            supabase_mock, {"id": "convo-1", "buyer_id": "buyer-1", "seller_id": "seller-1"}
        )

        self._mock_update_result(supabase_mock, [{"id": "msg-1"}])
        first = client.patch("/api/v1/conversations/convo-1/read")
        assert first.json() == {"marked_count": 1}

        # Second call: nothing left with read_at IS NULL for this conversation.
        self._mock_update_result(supabase_mock, [])
        second = client.patch("/api/v1/conversations/convo-1/read")

        assert second.status_code == 200
        assert second.json() == {"marked_count": 0}


class TestUnreadCount:
    def test_requires_authentication(self, client):
        response = client.get("/api/v1/conversations/unread-count")

        assert response.status_code == 401

    def test_returns_total_across_conversations(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        supabase_mock.table(
            "messages"
        ).select.return_value.neq.return_value.is_.return_value.or_.return_value.execute.return_value = (
            SimpleNamespace(data=[{"id": "msg-1"}, {"id": "msg-2"}], count=7)
        )

        response = client.get("/api/v1/conversations/unread-count")

        assert response.status_code == 200
        assert response.json() == {"total": 7}

        select_call = supabase_mock.table("messages").select
        select_call.return_value.neq.assert_called_once_with("sender_id", "buyer-1")
        select_call.return_value.neq.return_value.is_.assert_called_once_with("read_at", None)
        select_call.return_value.neq.return_value.is_.return_value.or_.assert_called_once_with(
            "buyer_id.eq.buyer-1,seller_id.eq.buyer-1", reference_table="conversations"
        )

    def test_returns_zero_when_count_is_none(self, authed_client, supabase_mock):
        supabase_mock.table(
            "messages"
        ).select.return_value.neq.return_value.is_.return_value.or_.return_value.execute.return_value = (
            SimpleNamespace(data=[], count=None)
        )

        response = authed_client.get("/api/v1/conversations/unread-count")

        assert response.status_code == 200
        assert response.json() == {"total": 0}
