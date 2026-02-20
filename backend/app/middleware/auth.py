"""
Simple password authentication middleware.
If APP_PASSWORD env var is set, all requests (except exempt paths) require a valid Bearer token.
If APP_PASSWORD is not set, auth is completely disabled (for local dev).
"""

import os
import uuid
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from fastapi import Request

logger = logging.getLogger(__name__)

# In-memory set of valid session tokens
_active_tokens: set[str] = set()

# Paths that never require authentication
EXEMPT_PATHS = {
    "/health",
    "/login",
    "/auth/status",
    "/docs",
    "/openapi.json",
    "/redoc",
}

# Path prefixes that never require authentication
EXEMPT_PREFIXES = (
    "/outputs/",
    "/assets/",
)


def is_auth_enabled() -> bool:
    """Check if password auth is enabled"""
    return bool(os.getenv("APP_PASSWORD", "").strip())


def validate_password(password: str) -> bool:
    """Validate password against APP_PASSWORD env var"""
    expected = os.getenv("APP_PASSWORD", "").strip()
    return password == expected and expected != ""


def create_token() -> str:
    """Create a new session token"""
    token = str(uuid.uuid4())
    _active_tokens.add(token)
    return token


def validate_token(token: str) -> bool:
    """Check if a token is valid"""
    return token in _active_tokens


def revoke_token(token: str):
    """Revoke a session token"""
    _active_tokens.discard(token)


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware that checks for Bearer token on all requests when APP_PASSWORD is set.
    Skips auth entirely if APP_PASSWORD is not configured.
    """

    async def dispatch(self, request: Request, call_next):
        # If auth is not enabled, pass through everything
        if not is_auth_enabled():
            return await call_next(request)

        # Check if path is exempt
        path = request.url.path
        if path in EXEMPT_PATHS or path.startswith(EXEMPT_PREFIXES):
            return await call_next(request)

        # Allow OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        # Check for Bearer token
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Authentication required. Please log in."}
            )

        token = auth_header.replace("Bearer ", "")
        if not validate_token(token):
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or expired token. Please log in again."}
            )

        return await call_next(request)
