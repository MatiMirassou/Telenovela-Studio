"""
Telenovela Agent v2 - Main FastAPI Application
State machine-based microservices architecture
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.database.session import init_db
from app.api import projects, ideas, structure, episodes, images, videos, export

# Initialize FastAPI app
app = FastAPI(
    title="Telenovela Agent v2",
    description="AI-powered telenovela script generation with state machines",
    version="2.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for generated images/videos
OUTPUTS_DIR = os.path.join(os.path.dirname(__file__), "..", "outputs")
os.makedirs(OUTPUTS_DIR, exist_ok=True)
app.mount("/outputs", StaticFiles(directory=OUTPUTS_DIR), name="outputs")

# Include routers

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


@app.on_event("startup")
def startup():
    """Initialize database on startup"""
    init_db()


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
