from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    dev_auth_bypass: bool = False
    database_url: str = "postgresql+psycopg://inplain:inplain@localhost:54321/inplain"
    redis_url: str = "redis://localhost:6380/0"
    enqueue_jobs: bool = False
    scheduler_interval_seconds: int = 30

    clerk_issuer: str | None = None
    clerk_jwks_url: str | None = None
    clerk_jwt_audience: str | None = None
    clerk_secret_key: str | None = None
    clerk_webhook_secret: str | None = None
    clerk_api_base_url: str = "https://api.clerk.com"

    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_price_id_pro: str | None = None
    stripe_price_id_business: str | None = None
    web_base_url: str = "http://localhost:3000"

    openrouter_api_key: str | None = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_primary_model: str = "anthropic/claude-3.5-sonnet"
    openrouter_fallback_model: str = "openai/gpt-4o-mini"

    postmark_server_token: str | None = None
    postmark_from_email: str | None = None
    postmark_base_url: str = "https://api.postmarkapp.com"


settings = Settings()
