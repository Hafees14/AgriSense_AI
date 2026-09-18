from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "AgriSense AI API"
    ENV: str = "development"
    DEBUG: bool = True

    SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "agrisense"
    DB_PASSWORD: str = "agrisense"
    DB_NAME: str = "agrisense_db"

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
        )

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    RATE_LIMIT_PER_MINUTE: int = 60
    INFERENCE_RATE_LIMIT_PER_MINUTE: int = 20

    INFERENCE_SERVICE_URL: str = "http://localhost:8001"
    WEATHER_API_KEY: str = ""
    WEATHER_API_BASE_URL: str = "https://api.open-meteo.com/v1"
    LLM_API_KEY: str = ""

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
    INTERNAL_API_URL: str = "http://api:8000"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()