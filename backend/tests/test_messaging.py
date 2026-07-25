from types import SimpleNamespace
from unittest.mock import MagicMock

from postgrest.exceptions import APIError


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
    """Lookup is always scoped to (buyer_id, seller_id) only -- there's a single
    thread per pair regardless of whether it was reached via listing_id or
    seller_id, so both creation paths share this same query shape."""
    supabase_mock.table(
        "conversations"
    ).select.return_value.eq.return_value.eq.return_value.execute.return_value = SimpleNamespace(data=data)


def _mock_profile_exists(supabase_mock, user_id="seller-1"):
    supabase_mock.table("profiles").select.return_value.eq.return_value.execute.return_value = SimpleNamespace(
        data=[{"user_id": user_id}]
    )


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


class TestCreateConversationWithSeller:
    """Generic 'message this seller' conversations (started from a seller's
    profile page) don't set a listing context -- they open/create the same
    single thread that exists for that (buyer, seller) pair, without
    attaching or clearing any listing."""

    def test_rejects_both_listing_id_and_seller_id(self, authed_client):
        response = authed_client.post(
            "/api/v1/conversations/", json={"listing_id": "listing-1", "seller_id": "seller-1"}
        )

        assert response.status_code == 422

    def test_rejects_neither_listing_id_nor_seller_id(self, authed_client):
        response = authed_client.post("/api/v1/conversations/", json={})

        assert response.status_code == 422

    def test_404_when_seller_missing(self, authed_client, supabase_mock):
        supabase_mock.table("profiles").select.return_value.eq.return_value.execute.return_value = SimpleNamespace(
            data=[]
        )

        response = authed_client.post("/api/v1/conversations/", json={"seller_id": "missing"})

        assert response.status_code == 404

    def test_cannot_message_self(self, authed_as, supabase_mock):
        client = authed_as(user_id="seller-1")
        _mock_profile_exists(supabase_mock, "seller-1")

        response = client.post("/api/v1/conversations/", json={"seller_id": "seller-1"})

        assert response.status_code == 400

    def test_creates_conversation_with_no_listing(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        _mock_profile_exists(supabase_mock, "seller-1")
        _mock_no_active_block(supabase_mock)
        _mock_existing_conversation(supabase_mock, [])
        supabase_mock.table("conversations").insert.return_value.execute.return_value = SimpleNamespace(
            data=[{"id": "convo-generic", "listing_id": None, "buyer_id": "buyer-1", "seller_id": "seller-1"}]
        )

        response = client.post("/api/v1/conversations/", json={"seller_id": "seller-1"})

        assert response.status_code == 201
        assert response.json()["listing_id"] is None
        insert_payload = supabase_mock.table("conversations").insert.call_args.args[0]
        assert "listing_id" not in insert_payload

    def test_returns_existing_conversation_idempotently(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        _mock_profile_exists(supabase_mock, "seller-1")
        _mock_no_active_block(supabase_mock)
        _mock_existing_conversation(
            supabase_mock,
            [{"id": "convo-existing", "listing_id": None, "buyer_id": "buyer-1", "seller_id": "seller-1"}],
        )

        response = client.post("/api/v1/conversations/", json={"seller_id": "seller-1"})

        assert response.status_code == 200
        assert response.json()["id"] == "convo-existing"
        supabase_mock.table("conversations").insert.assert_not_called()

    def test_does_not_clear_an_existing_listing_context(self, authed_as, supabase_mock):
        """If the buyer already has a thread with this seller carrying a
        listing context (set by a previous order-specific message), opening
        chat via the generic 'Message Seller' button must not wipe it out."""
        client = authed_as(user_id="buyer-1")
        _mock_profile_exists(supabase_mock, "seller-1")
        _mock_no_active_block(supabase_mock)
        _mock_existing_conversation(
            supabase_mock,
            [{"id": "convo-existing", "listing_id": "listing-a", "buyer_id": "buyer-1", "seller_id": "seller-1"}],
        )

        response = client.post("/api/v1/conversations/", json={"seller_id": "seller-1"})

        assert response.status_code == 200
        assert response.json()["listing_id"] == "listing-a"
        supabase_mock.table("conversations").update.assert_not_called()

    def test_lookup_is_scoped_to_buyer_and_seller_only(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        _mock_profile_exists(supabase_mock, "seller-1")
        _mock_no_active_block(supabase_mock)
        _mock_existing_conversation(supabase_mock, [])
        supabase_mock.table("conversations").insert.return_value.execute.return_value = SimpleNamespace(
            data=[{"id": "convo-generic", "listing_id": None, "buyer_id": "buyer-1", "seller_id": "seller-1"}]
        )

        client.post("/api/v1/conversations/", json={"seller_id": "seller-1"})

        select_mock = supabase_mock.table("conversations").select.return_value
        select_mock.eq.assert_called_once_with("buyer_id", "buyer-1")
        select_mock.eq.return_value.eq.assert_called_once_with("seller_id", "seller-1")


class TestConversationSharedPerSellerWithListingContext:
    """Regression test for a bug where messaging a seller about a purchased
    listing surfaced a different listing's conversation instead. Root cause
    was a frontend call site that always passed the seller's first listing
    rather than the one actually being messaged about.

    The fix keeps a single conversation thread per (buyer, seller) pair --
    opening chat from a specific listing/order updates that thread's listing
    context to the one just opened, so the thread always reflects the most
    recent order/listing the buyer actually came from, instead of whatever
    listing happened to be used when the thread was first created."""

    def test_listing_lookup_is_scoped_to_buyer_and_seller_only(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        _mock_listing(supabase_mock, listing_id="listing-a", seller_id="seller-1")
        _mock_no_active_block(supabase_mock)
        _mock_existing_conversation(supabase_mock, [])
        supabase_mock.table("conversations").insert.return_value.execute.return_value = SimpleNamespace(
            data=[{"id": "convo-1", "listing_id": "listing-a", "buyer_id": "buyer-1", "seller_id": "seller-1"}]
        )

        client.post("/api/v1/conversations/", json={"listing_id": "listing-a"})

        select_mock = supabase_mock.table("conversations").select.return_value
        select_mock.eq.assert_called_once_with("buyer_id", "buyer-1")
        select_mock.eq.return_value.eq.assert_called_once_with("seller_id", "seller-1")

    def test_messaging_about_a_second_listing_updates_the_same_threads_context(self, authed_as, supabase_mock):
        """Buyer bought listing A (Spinach), then later buys listing B
        (Noodles) from the same seller and opens chat about that order too.
        There must be exactly one conversation row throughout -- its
        listing_id ends up as B (the most recently opened order), and no
        second thread is ever created."""
        client = authed_as(user_id="buyer-1")
        _mock_no_active_block(supabase_mock)

        supabase_mock.table("crops_listings").select.return_value.eq.return_value.execute.side_effect = [
            SimpleNamespace(data=[{"id": "listing-a", "seller_id": "seller-1", "crop_name": "Spinach", "photo_url": None}]),
            SimpleNamespace(data=[{"id": "listing-b", "seller_id": "seller-1", "crop_name": "Noodles", "photo_url": None}]),
        ]
        conv_select = supabase_mock.table("conversations").select.return_value
        conv_select.eq.return_value.eq.return_value.execute.side_effect = [
            SimpleNamespace(data=[]),  # first message: no thread yet
            SimpleNamespace(data=[{"id": "convo-1", "listing_id": "listing-a", "buyer_id": "buyer-1", "seller_id": "seller-1"}]),
        ]
        supabase_mock.table("conversations").insert.return_value.execute.return_value = SimpleNamespace(
            data=[{"id": "convo-1", "listing_id": "listing-a", "buyer_id": "buyer-1", "seller_id": "seller-1"}]
        )
        supabase_mock.table("conversations").update.return_value.eq.return_value.execute.return_value = SimpleNamespace(
            data=[{"id": "convo-1", "listing_id": "listing-b", "buyer_id": "buyer-1", "seller_id": "seller-1"}]
        )

        resp_a = client.post("/api/v1/conversations/", json={"listing_id": "listing-a"})
        resp_b = client.post("/api/v1/conversations/", json={"listing_id": "listing-b"})

        assert resp_a.json()["id"] == "convo-1"
        assert resp_a.json()["listing_id"] == "listing-a"
        assert resp_b.json()["id"] == "convo-1"
        assert resp_b.json()["listing_id"] == "listing-b"

        supabase_mock.table("conversations").insert.assert_called_once()
        supabase_mock.table("conversations").update.assert_called_once_with({"listing_id": "listing-b"})
        supabase_mock.table("conversations").update.return_value.eq.assert_called_once_with("id", "convo-1")

    def test_reopening_with_the_same_listing_does_not_issue_an_update(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        _mock_listing(supabase_mock, listing_id="listing-a", seller_id="seller-1")
        _mock_no_active_block(supabase_mock)
        _mock_existing_conversation(
            supabase_mock,
            [{"id": "convo-1", "listing_id": "listing-a", "buyer_id": "buyer-1", "seller_id": "seller-1"}],
        )

        response = client.post("/api/v1/conversations/", json={"listing_id": "listing-a"})

        assert response.status_code == 200
        assert response.json()["listing_id"] == "listing-a"
        supabase_mock.table("conversations").update.assert_not_called()


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

    def test_returns_empty_list_when_no_conversations(self, authed_client, supabase_mock):
        supabase_mock.table(
            "conversations"
        ).select.return_value.or_.return_value.order.return_value.execute.return_value = SimpleNamespace(data=[])

        response = authed_client.get("/api/v1/conversations/")

        assert response.status_code == 200
        assert response.json() == []

    def test_scopes_query_to_the_caller(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        supabase_mock.table(
            "conversations"
        ).select.return_value.or_.return_value.order.return_value.execute.return_value = SimpleNamespace(data=[])

        client.get("/api/v1/conversations/")

        supabase_mock.table("conversations").select.return_value.or_.assert_called_once_with(
            "buyer_id.eq.buyer-1,seller_id.eq.buyer-1"
        )

    def test_orders_by_last_message_at_desc_with_nulls_last(self, authed_client, supabase_mock):
        supabase_mock.table(
            "conversations"
        ).select.return_value.or_.return_value.order.return_value.execute.return_value = SimpleNamespace(data=[])

        authed_client.get("/api/v1/conversations/")

        supabase_mock.table("conversations").select.return_value.or_.return_value.order.assert_called_once_with(
            "last_message_at", desc=True, nullsfirst=False
        )

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

    def test_applies_after_cursor(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        _mock_conversation_lookup(
            supabase_mock, {"id": "convo-1", "buyer_id": "buyer-1", "seller_id": "seller-1"}
        )
        supabase_mock.table(
            "messages"
        ).select.return_value.eq.return_value.order.return_value.limit.return_value.gt.return_value.execute.return_value = (
            SimpleNamespace(data=[{"id": "msg-2", "content": "newer"}])
        )

        response = client.get(
            "/api/v1/conversations/convo-1/messages", params={"after": "2026-07-01T00:00:00Z"}
        )

        assert response.status_code == 200
        assert response.json()[0]["id"] == "msg-2"


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


class TestSendMessageIdempotency:
    """POST with the same (conversation_id, client_msg_id) must not create a
    second row: it makes client-side send retries after a dropped connection
    safe to replay."""

    CLIENT_MSG_ID = "11111111-1111-1111-1111-111111111111"

    def _created_row(self):
        return {
            "id": "msg-1",
            "conversation_id": "convo-1",
            "sender_id": "buyer-1",
            "content": "hi",
            "client_msg_id": self.CLIENT_MSG_ID,
        }

    def test_rejects_invalid_client_msg_id_format(self, authed_client):
        response = authed_client.post(
            "/api/v1/conversations/convo-1/messages",
            json={"content": "hi", "client_msg_id": "not-a-uuid"},
        )

        assert response.status_code == 422

    def test_second_call_with_same_client_msg_id_returns_existing_row_and_200(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        _mock_conversation_lookup(
            supabase_mock, {"id": "convo-1", "buyer_id": "buyer-1", "seller_id": "seller-1"}
        )
        _mock_no_active_block(supabase_mock)

        created_row = self._created_row()
        lookup_execute = (
            supabase_mock.table("messages").select.return_value.eq.return_value.eq.return_value.execute
        )
        lookup_execute.side_effect = [
            SimpleNamespace(data=[]),  # first POST: not sent yet
            SimpleNamespace(data=[created_row]),  # second POST (retry): already exists
        ]
        supabase_mock.table("messages").insert.return_value.execute.return_value = SimpleNamespace(
            data=[created_row]
        )

        first = client.post(
            "/api/v1/conversations/convo-1/messages",
            json={"content": "hi", "client_msg_id": self.CLIENT_MSG_ID},
        )
        second = client.post(
            "/api/v1/conversations/convo-1/messages",
            json={"content": "hi", "client_msg_id": self.CLIENT_MSG_ID},
        )

        assert first.status_code == 201
        assert first.json()["id"] == "msg-1"
        assert second.status_code == 200
        assert second.json()["id"] == "msg-1"

        # Exactly one row was ever inserted -- the second call replayed it.
        supabase_mock.table("messages").insert.assert_called_once()
        insert_payload = supabase_mock.table("messages").insert.call_args.args[0]
        assert insert_payload["client_msg_id"] == self.CLIENT_MSG_ID

    def test_concurrent_retry_race_falls_back_to_existing_row(self, authed_as, supabase_mock):
        """Both requests pass the pre-insert existence check (neither sees the
        other's row yet), so the second insert hits the unique index and
        raises a Postgres 23505 -- the handler must recover by re-reading the
        row the first insert created, not bubble up a 500."""
        client = authed_as(user_id="buyer-1")
        _mock_conversation_lookup(
            supabase_mock, {"id": "convo-1", "buyer_id": "buyer-1", "seller_id": "seller-1"}
        )
        _mock_no_active_block(supabase_mock)

        created_row = self._created_row()
        lookup_execute = (
            supabase_mock.table("messages").select.return_value.eq.return_value.eq.return_value.execute
        )
        lookup_execute.side_effect = [
            SimpleNamespace(data=[]),  # pre-insert check, both requests
            SimpleNamespace(data=[created_row]),  # post-conflict re-read
        ]
        supabase_mock.table("messages").insert.return_value.execute.side_effect = [
            SimpleNamespace(data=[created_row]),
            APIError({"message": "duplicate key value", "code": "23505"}),
        ]

        first = client.post(
            "/api/v1/conversations/convo-1/messages",
            json={"content": "hi", "client_msg_id": self.CLIENT_MSG_ID},
        )
        second = client.post(
            "/api/v1/conversations/convo-1/messages",
            json={"content": "hi", "client_msg_id": self.CLIENT_MSG_ID},
        )

        assert first.status_code == 201
        assert second.status_code == 200
        assert second.json()["id"] == "msg-1"


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
            SimpleNamespace(
                data=[
                    {"id": "msg-1", "conversations": {"buyer_id": "buyer-1", "seller_id": "seller-1"}},
                    {"id": "msg-2", "conversations": {"buyer_id": "buyer-1", "seller_id": "seller-2"}},
                ]
            )
        )
        _mock_blocks_table(supabase_mock)

        response = client.get("/api/v1/conversations/unread-count")

        assert response.status_code == 200
        assert response.json() == {"total": 2}

        select_call = supabase_mock.table("messages").select
        select_call.return_value.neq.assert_called_once_with("sender_id", "buyer-1")
        select_call.return_value.neq.return_value.is_.assert_called_once_with("read_at", None)
        select_call.return_value.neq.return_value.is_.return_value.or_.assert_called_once_with(
            "buyer_id.eq.buyer-1,seller_id.eq.buyer-1", reference_table="conversations"
        )

    def test_returns_zero_when_no_unread_messages(self, authed_client, supabase_mock):
        supabase_mock.table(
            "messages"
        ).select.return_value.neq.return_value.is_.return_value.or_.return_value.execute.return_value = (
            SimpleNamespace(data=[])
        )

        response = authed_client.get("/api/v1/conversations/unread-count")

        assert response.status_code == 200
        assert response.json() == {"total": 0}

    def test_excludes_unread_messages_from_blocked_conversations(self, authed_as, supabase_mock):
        client = authed_as(user_id="buyer-1")
        supabase_mock.table(
            "messages"
        ).select.return_value.neq.return_value.is_.return_value.or_.return_value.execute.return_value = (
            SimpleNamespace(
                data=[
                    {"id": "msg-1", "conversations": {"buyer_id": "buyer-1", "seller_id": "seller-1"}},
                    {"id": "msg-2", "conversations": {"buyer_id": "buyer-1", "seller_id": "blocked-seller"}},
                ]
            )
        )
        _mock_blocks_table(supabase_mock, blocked_by_a=[{"blocked_id": "blocked-seller"}])

        response = client.get("/api/v1/conversations/unread-count")

        assert response.status_code == 200
        assert response.json() == {"total": 1}
