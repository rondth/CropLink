from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from main import app
from app.core.dependencies import get_current_user, get_current_user_id


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def supabase_mock(monkeypatch):
    """Stub out the supabase client used by the routers.

    `supabase.table(name)` returns the same MagicMock every time it's called
    with the same table name, so tests can configure e.g.
    `supabase_mock.table("profiles").select.return_value...` independently
    per table without caring about call order.
    """
    mock = MagicMock(name="supabase")
    tables: dict[str, MagicMock] = {}
    mock.table.side_effect = lambda name: tables.setdefault(name, MagicMock(name=f"table:{name}"))

    monkeypatch.setattr("app.api.v1.auth.supabase", mock)
    monkeypatch.setattr("app.api.v1.listings.supabase", mock)
    return mock


@pytest.fixture
def authed_as(client):
    """Override the auth dependencies with a fake decoded-JWT payload.

    Usage: `authed_as(role="buyer", user_id="user-2")` returns the shared
    TestClient with overrides installed; overrides are cleared after the test.
    """

    def _factory(role: str = "seller", user_id: str = "user-123"):
        payload = {"sub": user_id, "user_metadata": {"role": role}}
        app.dependency_overrides[get_current_user] = lambda: payload
        app.dependency_overrides[get_current_user_id] = lambda: payload["sub"]
        return client

    yield _factory

    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_current_user_id, None)


@pytest.fixture
def current_user():
    return {"sub": "user-123", "user_metadata": {"role": "seller"}}


@pytest.fixture
def authed_client(authed_as):
    return authed_as()
