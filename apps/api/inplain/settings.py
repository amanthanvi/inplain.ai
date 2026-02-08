from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://inplain:inplain@localhost:54321/inplain"
    internal_service_token: str = "dev-internal-token"

    # Optional (wired later)
    clerk_webhook_secret: str | None = None
    openrouter_api_key: str | None = None
    redis_url: str | None = None


settings = Settings()
