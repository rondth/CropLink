from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import json
from typing import Optional
from app.core.config import settings

bearer_scheme = HTTPBearer()

# Load the JWKS public key
jwks = json.loads(settings.supabase_jwt_public_key)  # your JWKS in .env

def _decode_token(token: str) -> dict:
    return jwt.decode(
        token,
        jwks,
        algorithms=["ES256"],
        audience="authenticated",
    )

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    token = credentials.credentials
    try:
        return _decode_token(token)
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user_id(user: dict = Depends(get_current_user)) -> str:
    return user["sub"]

def get_optional_user_id(request: Request) -> Optional[str]:
    """Like get_current_user_id, but returns None instead of raising for
    anonymous visitors (no/invalid Authorization header) on public routes."""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    scheme, _, token = auth_header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    try:
        return _decode_token(token)["sub"]
    except JWTError:
        return None