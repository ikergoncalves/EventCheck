from functools import lru_cache

from pydantic import PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: PostgresDsn
    test_database_url: PostgresDsn | None = None

    supabase_project_url: str
    supabase_jwt_audience: str = "authenticated"
    supabase_jwks_cache_seconds: int = 600

    cors_origins: str = ""
    environment: str = "development"
    app_version: str = "0.1.0"

    @property
    def supabase_issuer(self) -> str:
        return f"{self.supabase_project_url.rstrip('/')}/auth/v1"

    @property
    def supabase_jwks_url(self) -> str:
        return f"{self.supabase_issuer}/.well-known/jwks.json"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
