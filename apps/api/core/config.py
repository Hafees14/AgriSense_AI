import logging
from functools import lru_cache
from pathlib import Path
from urllib.parse import quote_plus

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("agrisense.config")

DEFAULT_SECRET_KEY = "change-me-in-production"

# apps/api/.env, found from this file's location so it loads no matter which
# folder you start uvicorn from. A ".env" in the current folder is read too;
# values in apps/api/.env win.
API_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(
            str(Path(__file__).resolve().parents[1] / ".env"),
            ".env",
        ),
        extra="ignore",
    )
    
    APP_NAME: str = "AgriSense AI API"
    ENV: str = "development"
    # DEBUG turns on SQL echo logging. Keep it off unless you are debugging.
    DEBUG: bool = False

    SECRET_KEY: str = DEFAULT_SECRET_KEY
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "agrisense"
    DB_PASSWORD: str = "agrisense"
    DB_NAME: str = "agrisense_db"

    # Full SQLAlchemy URL. If it is empty: when DB_HOST is set (in .env or the
    # environment) a MySQL URL is built from the DB_* values above; otherwise
    # a local SQLite file is used so the project runs with no setup.
    DATABASE_URL: str = ""

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    RATE_LIMIT_PER_MINUTE: int = 60
    INFERENCE_RATE_LIMIT_PER_MINUTE: int = 20

    INFERENCE_SERVICE_URL: str = "http://localhost:8001"
    # Shared secret sent to the inference service (header X-Inference-Key).
    # Must match INFERENCE_API_KEY on the inference service. Empty = no key.
    INFERENCE_API_KEY: str = ""
    WEATHER_API_KEY: str = ""
    WEATHER_API_BASE_URL: str = "https://api.open-meteo.com/v1"
    LLM_API_KEY: str = ""

    # Gemini assistant (POST /assistant/chat). Get a free key at
    # https://aistudio.google.com/apikey. Empty = assistant switched off (503).
    GEMINI_API_KEY: str = ""
    # Check AI Studio for the free models available to your key.
    GEMINI_MODEL: str = "gemini-2.5-flash"
    # Messages per user per day.
    ASSISTANT_DAILY_LIMIT: int = 30
    # Messages per day for all users together. Keep this below your key's real
    # daily quota, because the free quota is shared by every user of one key.
    ASSISTANT_GLOBAL_DAILY_LIMIT: int = 900

    # Anyone can self-register as "farmer" freely, but "officer"/"researcher"
    # accounts can review other farmers' diagnoses (see require_role in
    # core/deps.py) — self-service signup into those roles needs this shared
    # code so it isn't wide open. Empty string (the default) disables
    # officer/researcher signup entirely until a real code is configured.
    OFFICER_SIGNUP_CODE: str = ""

    # Base URL this API is served from, used to build public links to
    # locally-stored files (e.g. uploaded diagnosis images). This is what
    # the browser uses.
    API_PUBLIC_URL: str = "http://localhost:8000"

    # Base URL other containers (e.g. the inference service) use to reach
    # this API over the internal Docker network. "localhost" from inside
    # another container refers to that container itself, not this one, so
    # this must be the Docker Compose service name.
    # Leave empty when running without Docker: the inference service then uses API_PUBLIC_URL.
    # docker-compose.yml sets this to http://api:8000.
    INTERNAL_API_URL: str = ""

    @model_validator(mode="after")
    def _finalize(self) -> "Settings":
        # 1. Database URL: make DB_* actually work, so docs, CI and code agree.
        if not self.DATABASE_URL:
            if "DB_HOST" in self.model_fields_set:
                self.DATABASE_URL = (
                    f"mysql+pymysql://{quote_plus(self.DB_USER)}:{quote_plus(self.DB_PASSWORD)}"
                    f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
                )
            else:
                self.DATABASE_URL = "sqlite:///./agrisense.db"

        # 2. Secret key: refuse to start outside development with a weak key,
        #    because anyone who knows the default can forge login tokens.
        if not self.SECRET_KEY:
            self.SECRET_KEY = DEFAULT_SECRET_KEY
        weak = self.SECRET_KEY == DEFAULT_SECRET_KEY or len(self.SECRET_KEY) < 32
        if weak:
            if self.ENV.lower() in ("development", "dev", "test", "testing"):
                logger.warning("SECRET_KEY is weak or default. Fine for local use, never for production.")
            else:
                raise ValueError(
                    "SECRET_KEY is missing, default or shorter than 32 characters. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
                )

        # 3. Assistant limits must not be negative.
        self.ASSISTANT_DAILY_LIMIT = max(0, self.ASSISTANT_DAILY_LIMIT)
        self.ASSISTANT_GLOBAL_DAILY_LIMIT = max(0, self.ASSISTANT_GLOBAL_DAILY_LIMIT)
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()