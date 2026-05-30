from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_public_key: str
    stripe_webhook_secret: str | None = None

    class Config:
        env_file = ".env"

settings = Settings()
