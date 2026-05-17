from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas.auth import SignupRequest, LoginRequest, AuthResponse, RefreshRequest, MessageResponse
from app.core.supabase import supabase
from app.core.dependencies import get_current_user, get_current_user_id

router = APIRouter(prefix="/auth", tags=["Auth"])


# Signup endpoint
@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest):
    # 1. Create user in Supabase Auth
    try:
        auth_response = supabase.auth.sign_up(
            {"email": body.email, "password": body.password}
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    user = auth_response.user
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration failed. Email may already be in use.",
        )

    # 2. Insert profile row with role + name
    try:
        supabase.table("profiles").insert({
            "id": user.id,
            "email": body.email,
            "role": body.role,
            "name": body.name,
        }).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"User created but profile save failed: {str(e)}",
        )

    session = auth_response.session
    return AuthResponse(
        user_id=user.id,
        email=body.email,
        role=body.role,
        name=body.name,
        access_token=session.access_token,
        refresh_token=session.refresh_token,
    )


# Login endpoint
@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest):
    try:
        auth_response = supabase.auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    user = auth_response.user
    session = auth_response.session

    # Fetch role + name from profiles table
    profile = (
        supabase.table("profiles")
        .select("role, name")
        .eq("id", user.id)
        .single()
        .execute()
    )
    if not profile.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found.",
        )

    return AuthResponse(
        user_id=user.id,
        email=user.email,
        role=profile.data["role"],
        name=profile.data["name"],
        access_token=session.access_token,
        refresh_token=session.refresh_token,
    )


# Refresh endpoint
@router.post("/refresh", response_model=AuthResponse)
def refresh_token(body: RefreshRequest):
    try:
        auth_response = supabase.auth.refresh_session(body.refresh_token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not refresh session. Please log in again.",
        )

    user = auth_response.user
    session = auth_response.session

    profile = (
        supabase.table("profiles")
        .select("role, name")
        .eq("id", user.id)
        .single()
        .execute()
    )

    return AuthResponse(
        user_id=user.id,
        email=user.email,
        role=profile.data["role"],
        name=profile.data["name"],
        access_token=session.access_token,
        refresh_token=session.refresh_token,
    )


# Logout endpoint
@router.post("/logout", response_model=MessageResponse)
def logout(user_id: str = Depends(get_current_user_id)):
    try:
        supabase.auth.sign_out()
    except Exception:
        pass
    return MessageResponse(message="Logged out successfully.")


# Me endpoint (gets currently logged in user's full profile)
@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    user_id = user["sub"]

    profile = (
        supabase.table("profiles")
        .select("*")
        .eq("id", user_id)
        .single()
        .execute()
    )
    if not profile.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found.",
        )
    return profile.data