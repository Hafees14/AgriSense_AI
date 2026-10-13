import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from apps.api.core.config import settings
from apps.api.core.security import decode_token

_hits: dict[str, deque] = defaultdict(deque)


def _client_key(request: Request) -> str:
    # Rate-limit dependencies run before get_current_user, so request.state.user_id is not
    # set yet. Read the user from the bearer token here so limits are per user, not just per IP.
    user = getattr(request.state, "user_id", None)
    if not user:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            try:
                claims = decode_token(auth[7:])
                if claims.get("type") == "access":
                    user = claims.get("sub")
            except ValueError:
                user = None
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
        # Forget keys that went quiet so this dict cannot grow without limit.
        if len(_hits) > 5000:
            for k in [k for k, v in _hits.items() if not v or v[-1] < window_start]:
                del _hits[k]

    return _dependency
