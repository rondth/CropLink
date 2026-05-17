from pydantic import BaseModel, EmailStr
from typing import Literal


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    role: Literal["seller", "buyer"]
    full_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    user_id: str
    email: str
    role: str
    full_name: str
    access_token: str
    refresh_token: str


class RefreshRequest(BaseModel):
    refresh_token: str


class MessageResponse(BaseModel):
    message: str