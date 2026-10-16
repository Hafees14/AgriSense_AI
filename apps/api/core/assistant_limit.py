"""Daily usage limits for the Gemini assistant (in-memory, one process).

Save as: apps/api/core/assistant_limit.py

Two limits protect the shared free-tier quota:
- per user per day  (settings.ASSISTANT_DAILY_LIMIT)
- all users per day (settings.ASSISTANT_GLOBAL_DAILY_LIMIT)

Counters reset when the API restarts. With several API processes, use Redis.
"""
import threading
from datetime import datetime, timezone

from fastapi import HTTPException

from apps.api.core.config import settings

_lock = threading.Lock()
_day = ""
_per_user: dict[int, int] = {}
_global_count = 0


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def check_daily_limit(user_id: int) -> None:
    """Call once per assistant request. Raises 429 when a limit is reached."""
    global _day, _global_count
    with _lock:
        today = _today()
        if today != _day:  # new day: reset all counters
            _day = today
            _per_user.clear()
            _global_count = 0

        if _global_count >= settings.ASSISTANT_GLOBAL_DAILY_LIMIT:
            raise HTTPException(429, "The assistant has reached its daily limit. Please try again tomorrow.")
        if _per_user.get(user_id, 0) >= settings.ASSISTANT_DAILY_LIMIT:
            raise HTTPException(429, "You have reached your daily assistant limit. Please try again tomorrow.")

        _per_user[user_id] = _per_user.get(user_id, 0) + 1
        _global_count += 1


def refund_call(user_id: int) -> None:
    """Give a call back when Gemini itself failed, so errors do not use up the quota."""
    global _global_count
    with _lock:
        if _per_user.get(user_id, 0) > 0:
            _per_user[user_id] -= 1
        if _global_count > 0:
            _global_count -= 1
