"""
Rate limiting middleware using slowapi.
Protects expensive AI generation endpoints from abuse.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Create the limiter instance (keyed by client IP)
limiter = Limiter(key_func=get_remote_address)

# Rate limit strings for different endpoint tiers
AI_GENERATION_LIMIT = "5/minute"     # Text generation (ideas, structure, scripts, prompts)
MEDIA_GENERATION_LIMIT = "3/minute"  # Image/video generation (more expensive)
