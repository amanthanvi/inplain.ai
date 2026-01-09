from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    dev_auth_bypass: bool = False
    database_url: str = "postgresql+psycopg://inplain:inplain@localhost:54321/inplain"


settings = Settings()
