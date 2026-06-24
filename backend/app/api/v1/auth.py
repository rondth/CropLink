from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional, Union
from app.schemas.auth import SignupRequest, LoginRequest, AuthResponse, RefreshRequest, MessageResponse
from app.core.supabase import supabase
from app.core.config import settings
from app.core.dependencies import get_current_user, get_current_user_id

def _reset_db_auth():
    supabase.postgrest.auth(settings.supabase_service_role_key)

router = APIRouter(prefix="/auth", tags=["Auth"])

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    profile_picture_url: Optional[str] = None
    preffered_currency: Optional[str] = None
    bio: Optional[str] = None

# Signup endpoint
@router.post("/signup", response_model=Union[AuthResponse, MessageResponse], status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest):
    # 1. Create user in Supabase Auth
    try:
        auth_response = supabase.auth.sign_up({
            "email": body.email, 
            "password": body.password,
            "options": {
                "data": {
                    "role": body.role
                }
            }
        })
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    finally:
        _reset_db_auth()

    user = auth_response.user
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration failed. Email may already be in use.",
        )

    # 2. Insert profile row with role + name
    try:
        supabase.table("profiles").insert({
            "user_id": user.id,
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

    if not session:
        return MessageResponse(message="Signup successful! Please check your email to confirm your account.")

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
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    finally:
        _reset_db_auth()

    user = auth_response.user
    session = auth_response.session

    # Fetch role + name from profiles table
    profile = (
        supabase.table("profiles")
        .select("role, name, preffered_currency")
        .eq("user_id", user.id)
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
        preffered_currency=profile.data.get("preffered_currency"),
        access_token=session.access_token,
        refresh_token=session.refresh_token,
    )


# Refresh endpoint
@router.post("/refresh", response_model=AuthResponse)
def refresh_token(body: RefreshRequest):
    try:
        auth_response = supabase.auth.refresh_session(body.refresh_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not refresh session. Please log in again.",
        )
    finally:
        _reset_db_auth()

    user = auth_response.user
    session = auth_response.session

    profile = (
        supabase.table("profiles")
        .select("role, name, preffered_currency")
        .eq("user_id", user.id)
        .single()
        .execute()
    )

    return AuthResponse(
        user_id=user.id,
        email=user.email,
        role=profile.data["role"],
        name=profile.data["name"],
        preffered_currency=profile.data.get("preffered_currency"),
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
    finally:
        _reset_db_auth()
    return MessageResponse(message="Logged out successfully.")


# Public profile endpoint
@router.get("/profile/{user_id}")
def get_public_profile(user_id: str):
    profile = (
        supabase.table("profiles")
        .select("user_id, name, email, profile_picture_url, bio, role")
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found.")
    num_listings = (
        supabase.table("crops_listings")
        .select("id", count="exact")
        .eq("seller_id", user_id)
        .eq("status", "active")
        .execute()
        .count
    )
    profile.data["num_listings"] = num_listings
    return profile.data


# Me endpoint (gets currently logged in user's full profile)
@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    user_id = user["sub"]

    profile = (
        supabase.table("profiles")
        .select("*")
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not profile.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found.",
        )
    profile.data['num_listings'] = supabase.table("crops_listings").select("id", count="exact").eq("seller_id", user_id).execute().count
    
    return profile.data


# Update Profile endpoint
@router.patch("/me")
def update_me(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    user_id = user["sub"]
    
    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        return get_me(user=user)
        
    profile = (
        supabase.table("profiles")
        .update(update_data)
        .eq("user_id", user_id)
        .execute()
    )
    if not profile.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found or update failed.",
        )
    return profile.data[0]