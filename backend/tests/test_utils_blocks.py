from types import SimpleNamespace

from app.utils import get_blocked_user_ids


class _FakeQuery:
    def __init__(self, data):
        self._data = data

    def eq(self, *args, **kwargs):
        return self

    def execute(self):
        return SimpleNamespace(data=self._data)


class _FakeBlocksTable:
    def __init__(self, blocked_by_me, blocked_me):
        self._by_column = {
            "blocked_id": blocked_by_me,
            "blocker_id": blocked_me,
        }

    def select(self, column):
        return _FakeQuery(self._by_column[column])


class _FakeSupabase:
    def __init__(self, blocked_by_me=None, blocked_me=None):
        self._table = _FakeBlocksTable(blocked_by_me or [], blocked_me or [])

    def table(self, name):
        assert name == "blocks"
        return self._table


class TestGetBlockedUserIds:
    def test_returns_empty_set_when_no_blocks(self):
        assert get_blocked_user_ids(_FakeSupabase(), "user-1") == set()

    def test_includes_users_blocked_by_me(self):
        supabase = _FakeSupabase(blocked_by_me=[{"blocked_id": "user-2"}])

        assert get_blocked_user_ids(supabase, "user-1") == {"user-2"}

    def test_includes_users_who_blocked_me(self):
        supabase = _FakeSupabase(blocked_me=[{"blocker_id": "user-3"}])

        assert get_blocked_user_ids(supabase, "user-1") == {"user-3"}

    def test_combines_both_directions(self):
        supabase = _FakeSupabase(
            blocked_by_me=[{"blocked_id": "user-2"}],
            blocked_me=[{"blocker_id": "user-3"}],
        )

        assert get_blocked_user_ids(supabase, "user-1") == {"user-2", "user-3"}

    def test_deduplicates_overlapping_ids(self):
        supabase = _FakeSupabase(
            blocked_by_me=[{"blocked_id": "user-2"}],
            blocked_me=[{"blocker_id": "user-2"}],
        )

        assert get_blocked_user_ids(supabase, "user-1") == {"user-2"}
