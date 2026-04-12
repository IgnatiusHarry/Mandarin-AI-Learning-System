from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_key: str

    # Claude API
    anthropic_api_key: str

    # Telegram
    telegram_bot_token: str

    # OpenClaw Integration
    openclaw_api_secret: str

    # Cron
    cron_secret: str

    # App
    app_env: str = "development"
    frontend_url: str = "http://localhost:3000"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
