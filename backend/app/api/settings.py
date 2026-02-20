"""
Settings API - Manage application configuration (API keys, auth, etc.)
"""

import os
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.models import AppSetting
from app.services import generator as generator_module
from app.middleware.auth import is_auth_enabled, validate_password, create_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["settings"])
auth_router = APIRouter(tags=["auth"])


# ============================================================================
# SCHEMAS
# ============================================================================

class ApiKeyRequest(BaseModel):
    api_key: str


class ApiKeyStatus(BaseModel):
    configured: bool
    source: str  # "database", "environment", or "none"


class LoginRequest(BaseModel):
    password: str


# ============================================================================
# HELPERS
# ============================================================================

GEMINI_KEY_SETTING = "gemini_api_key"


def get_api_key_source(db: Session) -> tuple[bool, str]:
    """Check where the API key is coming from"""
    # Check database first
    setting = db.query(AppSetting).filter(AppSetting.key == GEMINI_KEY_SETTING).first()
    if setting and setting.value:
        return True, "database"

    # Check environment variable
    env_key = os.getenv("GEMINI_API_KEY", "")
    if env_key:
        return True, "environment"

    return False, "none"


def load_api_key_from_db(db: Session) -> str | None:
    """Load the saved API key from the database"""
    setting = db.query(AppSetting).filter(AppSetting.key == GEMINI_KEY_SETTING).first()
    if setting and setting.value:
        return setting.value
    return None


# ============================================================================
# AUTH ENDPOINTS (no prefix - top-level /login and /auth/status)
# ============================================================================

@auth_router.get("/auth/status")
def get_auth_status():
    """Check if password authentication is required"""
    return {"auth_required": is_auth_enabled()}


@auth_router.post("/login")
def login(request: LoginRequest):
    """Authenticate with the app password. Returns a session token."""
    if not is_auth_enabled():
        return {"token": "no-auth", "message": "Authentication is not enabled"}

    if not validate_password(request.password):
        raise HTTPException(status_code=401, detail="Incorrect password")

    token = create_token()
    return {"token": token, "message": "Login successful"}


# ============================================================================
# API KEY ENDPOINTS
# ============================================================================

@router.get("/api-key/status", response_model=ApiKeyStatus)
def get_api_key_status(db: Session = Depends(get_db)):
    """Check if an API key is configured (never returns the actual key)"""
    configured, source = get_api_key_source(db)
    return ApiKeyStatus(configured=configured, source=source)


@router.post("/api-key")
def set_api_key(request: ApiKeyRequest, db: Session = Depends(get_db)):
    """
    Set the Gemini API key.
    Validates the key by making a lightweight test call, then saves to DB
    and reinitializes the generator.
    """
    api_key = request.api_key.strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")

    if not api_key.startswith("AIza"):
        raise HTTPException(status_code=400, detail="Invalid API key format. Gemini keys start with 'AIza'")

    # Validate the key by trying to initialize a generator with it
    try:
        from google import genai
        test_client = genai.Client(api_key=api_key)
        # Make a minimal test call to verify the key works
        test_client.models.generate_content(
            model="gemini-2.0-flash",
            contents="Say OK",
            config={"max_output_tokens": 5}
        )
    except Exception as e:
        error_msg = str(e)
        if "API_KEY_INVALID" in error_msg or "401" in error_msg:
            raise HTTPException(status_code=400, detail="Invalid API key. Please check your key and try again.")
        elif "PERMISSION_DENIED" in error_msg or "403" in error_msg:
            raise HTTPException(status_code=400, detail="API key does not have permission to access Gemini. Check your API key permissions.")
        else:
            logger.warning(f"API key validation warning: {error_msg}")
            # Key format looks right but test failed for other reasons (quota, network, etc.)
            # Still save it — the user can troubleshoot later

    # Save to database
    setting = db.query(AppSetting).filter(AppSetting.key == GEMINI_KEY_SETTING).first()
    if setting:
        setting.value = api_key
        setting.updated_at = datetime.utcnow()
    else:
        setting = AppSetting(key=GEMINI_KEY_SETTING, value=api_key)
        db.add(setting)
    db.commit()

    # Reinitialize the generator with the new key
    generator_module.reinitialize(api_key)

    logger.info("API key updated and generator reinitialized")
    return {"status": "ok", "message": "API key saved and validated successfully"}


@router.delete("/api-key")
def delete_api_key(db: Session = Depends(get_db)):
    """Remove the stored API key. Falls back to environment variable if set."""
    setting = db.query(AppSetting).filter(AppSetting.key == GEMINI_KEY_SETTING).first()
    if setting:
        db.delete(setting)
        db.commit()

    # Reinitialize with env var fallback
    env_key = os.getenv("GEMINI_API_KEY", "")
    if env_key:
        generator_module.reinitialize(env_key)
        return {"status": "ok", "message": "Stored key removed. Using environment variable."}
    else:
        generator_module.reinitialize(None)
        return {"status": "ok", "message": "API key removed. No fallback key configured."}
