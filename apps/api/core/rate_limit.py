import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from apps.api.core.config import settings

_hits: dict[str, deque] = defaultdict(deque)


def _client_key(request: Request) -> str:
    user = getattr(request.state, "user_id", None)
    if user:
        return f"user:{user}"
    return f"ip:{request.client.host if request.client else 'unknown'}"


def rate_limit(max_per_minute: int | None = None):
    limit = max_per_minute or settings.RATE_LIMIT_PER_MINUTE

    async def _dependency(request: Request):
        key = _client_key(request)
        window_start = time.time() - 60
        q = _hits[key]
        while q and q[0] < window_start:
            q.popleft()
        if len(q) >= limit:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded.")
        q.append(time.time())

    return _dependency
