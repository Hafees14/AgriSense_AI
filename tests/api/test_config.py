import pytest


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    # The suite sets DATABASE_URL for the app; these tests need a clean slate.
    for k in ("DATABASE_URL", "DB_HOST", "DEBUG", "SECRET_KEY", "ENV"):
        monkeypatch.delenv(k, raising=False)

from apps.api.core.config import Settings


def test_production_refuses_default_secret():
    with pytest.raises(ValueError):
        Settings(_env_file=None, ENV="production", SECRET_KEY="change-me-in-production")


def test_production_refuses_short_secret():
    with pytest.raises(ValueError):
        Settings(_env_file=None, ENV="production", SECRET_KEY="short")


def test_production_accepts_strong_secret():
    assert Settings(_env_file=None, ENV="production", SECRET_KEY="x" * 40).ENV == "production"


def test_db_settings_build_a_mysql_url_when_db_host_is_set():
    s = Settings(_env_file=None, ENV="test", DB_HOST="mysql", DB_USER="u", DB_PASSWORD="p@ss", DB_NAME="d")
    assert s.DATABASE_URL == "mysql+pymysql://u:p%40ss@mysql:3306/d"


def test_sqlite_fallback_when_nothing_is_configured():
    assert Settings(_env_file=None, ENV="test").DATABASE_URL.startswith("sqlite")


def test_explicit_database_url_wins():
    s = Settings(_env_file=None, ENV="test", DB_HOST="mysql", DATABASE_URL="sqlite:///x.db")
    assert s.DATABASE_URL == "sqlite:///x.db"


def test_debug_is_off_by_default():
    assert Settings(_env_file=None, ENV="test").DEBUG is False
