from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://inplain:inplain@localhost:54321/inplain"
    internal_service_token: str = "dev-internal-token"

    # Optional (wired later)
    clerk_webhook_secret: str | None = None
    openrouter_api_key: str | None = None
    openrouter_http_referer: str = "https://inplain.ai"
    openrouter_x_title: str = "Inplain.ai"
    redis_url: str | None = None
    posthog_api_key: str | None = None
    posthog_host: str | None = None
    sentry_dsn: str | None = None
    sentry_environment: str = "development"
    sentry_traces_sample_rate: float = 0.0


settings = Settings()
