from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_public_key: str

    stripe_secret_key: str
    stripe_webhook_secret: str

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()