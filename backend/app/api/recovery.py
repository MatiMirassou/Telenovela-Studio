"""
Recovery API routes for resetting stuck GENERATING entities
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.models import (
    Project, Episode, CharacterRef, LocationRef, GeneratedImage,
    Thumbnail, GeneratedVideo,
    GenerationState, MediaState
)

router = APIRouter(tags=["recovery"])

# Entity type -> (model_class, generating_value, pending_value)
ENTITY_MAP = {
    "episodes": (Episode, GenerationState.GENERATING, GenerationState.PENDING),
    "character-refs": (CharacterRef, MediaState.GENERATING, MediaState.PENDING),
    "location-refs": (LocationRef, MediaState.GENERATING, MediaState.PENDING),
    "generated-images": (GeneratedImage, MediaState.GENERATING, MediaState.PENDING),
    "thumbnails": (Thumbnail, MediaState.GENERATING, MediaState.PENDING),
    "generated-videos": (GeneratedVideo, MediaState.GENERATING, MediaState.PENDING),
}


@router.post("/{entity_type}/{entity_id}/reset")
def reset_stuck_entity(entity_type: str, entity_id: str, db: Session = Depends(get_db)):
    """Reset a stuck GENERATING entity back to PENDING"""
    if entity_type not in ENTITY_MAP:
        raise HTTPException(status_code=400, detail=f"Unknown entity type: {entity_type}")

    model_class, generating_state, pending_state = ENTITY_MAP[entity_type]
    entity = db.query(model_class).filter(model_class.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    if entity.state != generating_state:
        raise HTTPException(
            status_code=400,
            detail=f"Entity is not stuck (state: {entity.state.value})"
        )

    entity.transition_to(pending_state)
    db.commit()
    return {"status": "reset", "entity_id": entity_id, "new_state": "pending"}


@router.get("/projects/{project_id}/stuck")
def get_stuck_entities(
    project_id: str,
    minutes: int = Query(default=10, ge=1),
    db: Session = Depends(get_db)
):
    """Get all entities stuck in GENERATING for more than N minutes"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    cutoff = datetime.utcnow() - timedelta(minutes=minutes)
    stuck = []

    # Check episodes
    for ep in project.episodes:
        if ep.state == GenerationState.GENERATING and ep.created_at < cutoff:
            stuck.append({
                "entity_type": "episodes",
                "entity_id": ep.id,
                "state": ep.state.value,
                "created_at": ep.created_at.isoformat(),
            })

    # Check nested media entities through episodes -> scenes
    for ep in project.episodes:
        for scene in ep.scenes:
            for ip in scene.image_prompts:
                if ip.generated_image and ip.generated_image.state == MediaState.GENERATING:
                    if ip.generated_image.created_at < cutoff:
                        stuck.append({
                            "entity_type": "generated-images",
                            "entity_id": ip.generated_image.id,
                            "state": ip.generated_image.state.value,
                            "created_at": ip.generated_image.created_at.isoformat(),
                        })
            for vp in scene.video_prompts:
                if vp.generated_video and vp.generated_video.state == MediaState.GENERATING:
                    if vp.generated_video.created_at < cutoff:
                        stuck.append({
                            "entity_type": "generated-videos",
                            "entity_id": vp.generated_video.id,
                            "state": vp.generated_video.state.value,
                            "created_at": vp.generated_video.created_at.isoformat(),
                        })

    # Check character refs
    for char in project.characters:
        if char.reference and char.reference.state == MediaState.GENERATING:
            if char.reference.created_at < cutoff:
                stuck.append({
                    "entity_type": "character-refs",
                    "entity_id": char.reference.id,
                    "state": char.reference.state.value,
                    "created_at": char.reference.created_at.isoformat(),
                })

    # Check location refs
    for loc in project.locations:
        if loc.reference and loc.reference.state == MediaState.GENERATING:
            if loc.reference.created_at < cutoff:
                stuck.append({
                    "entity_type": "location-refs",
                    "entity_id": loc.reference.id,
                    "state": loc.reference.state.value,
                    "created_at": loc.reference.created_at.isoformat(),
                })

    # Check thumbnails
    for thumb in project.thumbnails:
        if thumb.state == MediaState.GENERATING and thumb.created_at < cutoff:
            stuck.append({
                "entity_type": "thumbnails",
                "entity_id": thumb.id,
                "state": thumb.state.value,
                "created_at": thumb.created_at.isoformat(),
            })

    return {"stuck": stuck, "count": len(stuck)}
