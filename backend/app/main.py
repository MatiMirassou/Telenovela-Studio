"""
Telenovela Agent v2 - Main FastAPI Application
State machine-based microservices architecture
"""

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import os
import logging

from app.database.session import init_db, get_db_context
from app.api import projects, ideas, structure, episodes, images, videos, export, settings, recovery
from app.models.models import AppSetting
from app.models.mixins import InvalidTransitionError
from app.services import generator as generator_module
from app.middleware.rate_limit import limiter
from app.middleware.auth import AuthMiddleware

logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Telenovela Agent v2",
    description="AI-powered telenovela script generation with state machines",
    version="2.0.0"
)

# ============================================================================
# MIDDLEWARE (order matters: CORS first, then auth, then rate limiting)
# ============================================================================

# Auth middleware (only active if APP_PASSWORD env var is set) — added first so it's INNER
app.add_middleware(AuthMiddleware)

# CORS configuration — added LAST so it's OUTERMOST (processes requests first)
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
cors_origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# State machine invalid transition handler
@app.exception_handler(InvalidTransitionError)
async def invalid_transition_handler(request: Request, exc: InvalidTransitionError):
    return JSONResponse(
        status_code=409,
        content={"detail": str(exc)}
    )

# ============================================================================
# STATIC FILES
# ============================================================================

# Mount static files for generated images/videos
OUTPUTS_DIR = os.path.join(os.path.dirname(__file__), "..", "outputs")
os.makedirs(OUTPUTS_DIR, exist_ok=True)
app.mount("/outputs", StaticFiles(directory=OUTPUTS_DIR), name="outputs")

# ============================================================================
# ROUTERS
# ============================================================================

# Auth routes (login, auth/status - no prefix)
app.include_router(settings.auth_router)

# Settings routes (API key management)
app.include_router(settings.router)

# Project-level routes
app.include_router(projects.router)

# Ideas routes (Step 1-2)
app.include_router(ideas.router)
app.include_router(ideas.idea_router)

# Structure routes (Step 3-4)
app.include_router(structure.router)
app.include_router(structure.character_router)
app.include_router(structure.location_router)
app.include_router(structure.episode_summary_router)

# Episode routes (Step 5)
app.include_router(episodes.router)
app.include_router(episodes.episode_router)

# Image routes (Steps 6-10)
app.include_router(images.router)
app.include_router(images.image_prompt_router)
app.include_router(images.character_ref_router)
app.include_router(images.location_ref_router)
app.include_router(images.thumbnail_router)
app.include_router(images.generated_image_router)

# Video routes (Steps 11-12)
app.include_router(videos.router)
app.include_router(videos.video_prompt_router)
app.include_router(videos.generated_video_router)

# Export routes
app.include_router(export.router)

# Recovery routes (reset stuck entities)
app.include_router(recovery.router)


# ============================================================================
# SERVE FRONTEND IN PRODUCTION
# ============================================================================

# Path to the built frontend (populated during Docker build)
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")

if os.path.isdir(FRONTEND_DIR):
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="frontend-assets")

    # API prefixes that should NOT be intercepted by SPA fallback
    _API_PREFIXES = (
        "projects", "ideas", "characters", "locations",
        "episode-summaries", "episodes", "image-prompts",
        "character-refs", "location-refs", "generated-images",
        "thumbnails", "video-prompts", "generated-videos",
        "settings", "outputs", "docs", "openapi.json", "health",
        "login", "auth", "export", "recovery",
    )

    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.responses import Response as StarletteResponse

    class SPAFallbackMiddleware(BaseHTTPMiddleware):
        """Serve index.html for non-API GET requests (SPA client-side routing)."""
        async def dispatch(self, request: Request, call_next):
            response = await call_next(request)

            # Only intercept GET requests that got a 404 and aren't API routes
            if (request.method == "GET"
                    and response.status_code == 404
                    and not request.url.path.lstrip("/").startswith(_API_PREFIXES)):
                # Try to serve the exact file
                rel_path = request.url.path.lstrip("/")
                file_path = os.path.join(FRONTEND_DIR, rel_path)
                if rel_path and os.path.isfile(file_path):
                    return FileResponse(file_path)
                # Fallback to index.html for SPA routing
                return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

            return response

    app.add_middleware(SPAFallbackMiddleware)


# ============================================================================
# STARTUP
# ============================================================================

@app.on_event("startup")
def startup():
    """Initialize database, run migrations, and load saved config on startup"""
    # Initialize database (create tables if they don't exist)
    init_db()

    # Run Alembic migrations if available
    try:
        from alembic.config import Config
        from alembic import command
        from alembic.runtime.migration import MigrationContext
        from sqlalchemy import inspect as sa_inspect

        alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
        alembic_cfg.set_main_option("script_location",
                                     os.path.join(os.path.dirname(__file__), "..", "alembic"))

        # Check if this is an existing DB that predates Alembic (has tables but no version)
        from app.database.session import engine
        with engine.connect() as conn:
            context = MigrationContext.configure(conn)
            current_rev = context.get_current_revision()
            inspector = sa_inspect(engine)
            existing_tables = inspector.get_table_names()

        if current_rev is None and len(existing_tables) > 1:
            # Existing DB without Alembic tracking — stamp it at the initial revision
            command.stamp(alembic_cfg, "head")
            logger.info("Stamped existing database with current Alembic revision")
        else:
            # Fresh DB or already tracked — run migrations normally
            command.upgrade(alembic_cfg, "head")
            logger.info("Database migrations applied successfully")
    except Exception as e:
        logger.warning(f"Alembic migration skipped: {e}")

    # Load API key from database if previously saved
    try:
        with get_db_context() as db:
            setting = db.query(AppSetting).filter(AppSetting.key == "gemini_api_key").first()
            if setting and setting.value:
                generator_module.reinitialize(setting.value)
                logger.info("Loaded API key from database")
            else:
                env_key = os.getenv("GEMINI_API_KEY", "")
                if env_key:
                    logger.info("Using API key from environment variable")
                else:
                    logger.warning("No API key configured. Set one via the Settings UI or GEMINI_API_KEY env var.")
    except Exception as e:
        logger.warning(f"Could not load saved API key: {e}")

    # Log auth status
    if os.getenv("APP_PASSWORD", "").strip():
        logger.info("Password authentication is ENABLED")
    else:
        logger.info("Password authentication is DISABLED (set APP_PASSWORD to enable)")


@app.get("/")
def root():
    """API root"""
    return {
        "name": "Telenovela Agent v2",
        "version": "2.0.0",
        "architecture": "State Machine Microservices",
        "steps": {
            1: "Generate Ideas",
            2: "Select Idea",
            3: "Generate Structure",
            4: "Approve Structure",
            5: "Generate Episode Scripts",
            6: "Generate Image Prompts",
            7: "Generate Reference Images",
            8: "Generate Images",
            9: "Generate Thumbnails",
            10: "Review Images",
            11: "Generate Video Prompts",
            12: "Generate Videos"
        }
    }


@app.get("/health")
def health():
    """Health check endpoint"""
    return {"status": "healthy"}
