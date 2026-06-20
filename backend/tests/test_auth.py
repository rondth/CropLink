from types import SimpleNamespace


class TestSignup:
    def test_returns_tokens_when_session_present(self, client, supabase_mock):
        supabase_mock.auth.sign_up.return_value = SimpleNamespace(
            user=SimpleNamespace(id="user-1"),
            session=SimpleNamespace(access_token="access-token", refresh_token="refresh-token"),
        )
        supabase_mock.table("profiles").insert.return_value.execute.return_value = SimpleNamespace(data=[{}])

        response = client.post(
            "/api/v1/auth/signup",
            json={"email": "farmer@example.com", "password": "supersecret", "role": "seller", "name": "Farmer Joe"},
        )

        assert response.status_code == 201
        body = response.json()
        assert body["user_id"] == "user-1"
        assert body["access_token"] == "access-token"
        assert body["role"] == "seller"

    def test_without_session_prompts_email_confirmation(self, client, supabase_mock):
        supabase_mock.auth.sign_up.return_value = SimpleNamespace(user=SimpleNamespace(id="user-1"), session=None)
        supabase_mock.table("profiles").insert.return_value.execute.return_value = SimpleNamespace(data=[{}])

        response = client.post(
            "/api/v1/auth/signup",
            json={"email": "farmer@example.com", "password": "supersecret", "role": "seller", "name": "Farmer Joe"},
        )

        assert response.status_code == 201
        assert "confirm your account" in response.json()["message"]

    def test_fails_when_supabase_rejects_user(self, client, supabase_mock):
        supabase_mock.auth.sign_up.return_value = SimpleNamespace(user=None, session=None)

        response = client.post(
            "/api/v1/auth/signup",
            json={"email": "farmer@example.com", "password": "supersecret", "role": "seller", "name": "Farmer Joe"},
        )

        assert response.status_code == 400

    def test_rejects_invalid_role(self, client, supabase_mock):
        response = client.post(
            "/api/v1/auth/signup",
            json={"email": "farmer@example.com", "password": "supersecret", "role": "admin", "name": "Farmer Joe"},
        )

        assert response.status_code == 422


class TestLogin:
    def test_returns_profile_and_tokens(self, client, supabase_mock):
        supabase_mock.auth.sign_in_with_password.return_value = SimpleNamespace(
            user=SimpleNamespace(id="user-1", email="farmer@example.com"),
            session=SimpleNamespace(access_token="access-token", refresh_token="refresh-token"),
        )
        supabase_mock.table("profiles").select.return_value.eq.return_value.single.return_value.execute.return_value = (
            SimpleNamespace(data={"role": "seller", "name": "Farmer Joe", "preffered_currency": "USD"})
        )

        response = client.post("/api/v1/auth/login", json={"email": "farmer@example.com", "password": "supersecret"})

        assert response.status_code == 200
        body = response.json()
        assert body["role"] == "seller"
        assert body["access_token"] == "access-token"

    def test_rejects_bad_credentials(self, client, supabase_mock):
        supabase_mock.auth.sign_in_with_password.side_effect = Exception("invalid credentials")

        response = client.post("/api/v1/auth/login", json={"email": "farmer@example.com", "password": "wrong"})

        assert response.status_code == 401

    def test_fails_when_profile_missing(self, client, supabase_mock):
        supabase_mock.auth.sign_in_with_password.return_value = SimpleNamespace(
            user=SimpleNamespace(id="user-1", email="farmer@example.com"),
            session=SimpleNamespace(access_token="access-token", refresh_token="refresh-token"),
        )
        supabase_mock.table("profiles").select.return_value.eq.return_value.single.return_value.execute.return_value = (
            SimpleNamespace(data=None)
        )

        response = client.post("/api/v1/auth/login", json={"email": "farmer@example.com", "password": "supersecret"})

        assert response.status_code == 404


class TestRefresh:
    def test_returns_new_tokens(self, client, supabase_mock):
        supabase_mock.auth.refresh_session.return_value = SimpleNamespace(
            user=SimpleNamespace(id="user-1", email="farmer@example.com"),
            session=SimpleNamespace(access_token="new-access", refresh_token="new-refresh"),
        )
        supabase_mock.table("profiles").select.return_value.eq.return_value.single.return_value.execute.return_value = (
            SimpleNamespace(data={"role": "seller", "name": "Farmer Joe", "preffered_currency": "USD"})
        )

        response = client.post("/api/v1/auth/refresh", json={"refresh_token": "old-refresh"})

        assert response.status_code == 200
        assert response.json()["access_token"] == "new-access"

    def test_rejects_invalid_token(self, client, supabase_mock):
        supabase_mock.auth.refresh_session.side_effect = Exception("expired")

        response = client.post("/api/v1/auth/refresh", json={"refresh_token": "bad"})

        assert response.status_code == 401


class TestLogout:
    def test_requires_authentication(self, client):
        response = client.post("/api/v1/auth/logout")

        assert response.status_code == 401

    def test_succeeds_for_authenticated_user(self, authed_client, supabase_mock):
        response = authed_client.post("/api/v1/auth/logout")

        assert response.status_code == 200
        assert response.json()["message"] == "Logged out successfully."


class TestPublicProfile:
    def test_returns_listing_count(self, client, supabase_mock):
        supabase_mock.table("profiles").select.return_value.eq.return_value.single.return_value.execute.return_value = (
            SimpleNamespace(
                data={
                    "user_id": "user-1",
                    "name": "Farmer Joe",
                    "email": "x@example.com",
                    "profile_picture_url": None,
                    "bio": None,
                    "role": "seller",
                }
            )
        )
        supabase_mock.table("crops_listings").select.return_value.eq.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(count=3)
        )

        response = client.get("/api/v1/auth/profile/user-1")

        assert response.status_code == 200
        assert response.json()["num_listings"] == 3

    def test_404_when_missing(self, client, supabase_mock):
        supabase_mock.table("profiles").select.return_value.eq.return_value.single.return_value.execute.return_value = (
            SimpleNamespace(data=None)
        )

        response = client.get("/api/v1/auth/profile/missing-user")

        assert response.status_code == 404


class TestMe:
    def test_returns_profile_with_listing_count(self, authed_client, supabase_mock, current_user):
        supabase_mock.table("profiles").select.return_value.eq.return_value.single.return_value.execute.return_value = (
            SimpleNamespace(data={"user_id": current_user["sub"], "name": "Farmer Joe", "role": "seller"})
        )
        supabase_mock.table("crops_listings").select.return_value.eq.return_value.execute.return_value = SimpleNamespace(
            count=2
        )

        response = authed_client.get("/api/v1/auth/me")

        assert response.status_code == 200
        assert response.json()["num_listings"] == 2

    def test_requires_authentication(self, client):
        response = client.get("/api/v1/auth/me")

        assert response.status_code == 401

    def test_update_persists_changes(self, authed_client, supabase_mock):
        supabase_mock.table("profiles").update.return_value.eq.return_value.execute.return_value = SimpleNamespace(
            data=[{"name": "New Name"}]
        )

        response = authed_client.patch("/api/v1/auth/me", json={"name": "New Name"})

        assert response.status_code == 200
        assert response.json()["name"] == "New Name"

    def test_update_with_no_fields_returns_current_profile(self, authed_client, supabase_mock, current_user):
        supabase_mock.table("profiles").select.return_value.eq.return_value.single.return_value.execute.return_value = (
            SimpleNamespace(data={"user_id": current_user["sub"], "name": "Farmer Joe", "role": "seller"})
        )
        supabase_mock.table("crops_listings").select.return_value.eq.return_value.execute.return_value = SimpleNamespace(
            count=0
        )

        response = authed_client.patch("/api/v1/auth/me", json={})

        assert response.status_code == 200
        assert response.json()["name"] == "Farmer Joe"

    def test_update_404_when_profile_missing(self, authed_client, supabase_mock):
        supabase_mock.table("profiles").update.return_value.eq.return_value.execute.return_value = SimpleNamespace(
            data=[]
        )

        response = authed_client.patch("/api/v1/auth/me", json={"name": "New Name"})

        assert response.status_code == 404
