from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request, status

_attempts: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()


def rate_limit(max_requests: int = 5, window_seconds: int = 60):
    def check(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        bucket_key = f"{request.url.path}:{client_ip}"
        now = monotonic()
        cutoff = now - window_seconds
        with _lock:
            # Expire old buckets so occasional IPs do not remain in memory forever.
            for address in list(_attempts):
                bucket = _attempts[address]
                while bucket and bucket[0] <= cutoff:
                    bucket.popleft()
                if not bucket:
                    del _attempts[address]
            bucket = _attempts[bucket_key]
            if len(bucket) >= max_requests:
                retry_after = max(1, int(window_seconds - (now - bucket[0])))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many attempts. Please try again later.",
                    headers={"Retry-After": str(retry_after)},
                )
            bucket.append(now)
    return check
