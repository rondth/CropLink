import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.utils import sort_and_deduplicate

ROWS = [
    {"id": "a", "created_at": "2024-01-01T10:00:00"},
    {"id": "b", "created_at": "2024-01-03T10:00:00"},
    {"id": "c", "created_at": "2024-01-02T10:00:00"},
]


class TestSort:
    def test_desc_order(self):
        result = sort_and_deduplicate(list(ROWS), "desc")
        assert [r["id"] for r in result] == ["b", "c", "a"]

    def test_asc_order(self):
        result = sort_and_deduplicate(list(ROWS), "asc")
        assert [r["id"] for r in result] == ["a", "c", "b"]

    def test_default_is_desc(self):
        result = sort_and_deduplicate(list(ROWS))
        assert [r["id"] for r in result] == ["b", "c", "a"]

    def test_missing_created_at_sorts_last_in_desc(self):
        rows = [
            {"id": "a", "created_at": "2024-01-01T10:00:00"},
            {"id": "b"},
        ]
        result = sort_and_deduplicate(rows, "desc")
        assert result[0]["id"] == "a"


class TestDeduplicate:
    def test_removes_duplicate_ids(self):
        rows = [
            {"id": "a", "created_at": "2024-01-02T00:00:00"},
            {"id": "a", "created_at": "2024-01-01T00:00:00"},
            {"id": "b", "created_at": "2024-01-03T00:00:00"},
        ]
        result = sort_and_deduplicate(rows, "desc")
        ids = [r["id"] for r in result]
        assert ids == ["b", "a"]

    def test_keeps_first_occurrence_after_sort(self):
        rows = [
            {"id": "x", "created_at": "2024-01-01T00:00:00"},
            {"id": "x", "created_at": "2024-01-03T00:00:00"},
        ]
        result = sort_and_deduplicate(rows, "desc")
        assert len(result) == 1
        assert result[0]["created_at"] == "2024-01-03T00:00:00"

    def test_no_duplicates_unchanged_length(self):
        result = sort_and_deduplicate(list(ROWS), "desc")
        assert len(result) == 3

    def test_empty_list(self):
        assert sort_and_deduplicate([], "desc") == []
