from functools import lru_cache
from pathlib import Path
from urllib.parse import urlsplit

from pydantic import Field, ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Respiratory Screening Platform"
    database_url: str
    secret_key: str = Field(min_length=32)
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    upload_dir: str = "uploads"
    frontend_origin: str = "http://localhost:5173"
    model_path: Path = Path(__file__).resolve().parent.parent / "ml" / "model" / "mobilenetv2-v1.0.keras"

    @field_validator("frontend_origin")
    @classmethod
    def normalize_frontend_origin(cls, value: str) -> str:
        value = value.rstrip("/")
        parsed = urlsplit(value)
        if (
            "*" in value
            or parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.path
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("FRONTEND_ORIGIN must be one explicit http(s) origin without a path")
        return value

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    try:
        return Settings()
    except ValidationError as exc:
        missing = {str(error["loc"][0]) for error in exc.errors() if error.get("type") == "missing"}
        invalid = {str(error["loc"][0]) for error in exc.errors()}
        problems = []
        if "secret_key" in missing:
            problems.append("SECRET_KEY is required")
        elif "secret_key" in invalid:
            problems.append("SECRET_KEY must be at least 32 characters")
        if "database_url" in missing:
            problems.append("DATABASE_URL is required")
        if not problems:
            problems.append("application settings are invalid")
        raise RuntimeError("Configuration error: " + "; ".join(problems) + ".") from exc


settings = get_settings()
