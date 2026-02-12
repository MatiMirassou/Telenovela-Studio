"""
Images API routes (Steps 6, 7, 8, 9, 10)
- Step 6: Generate Image Prompts
- Step 7: Generate Reference Images
- Step 8: Generate Images
- Step 9: Generate Thumbnails
- Step 10: Review/Approve Images
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import os
import logging

from app.database.session import get_db
from app.models.models import (
    Project, Episode, Scene, Character, Location,
    ImagePrompt, CharacterRef, LocationRef, GeneratedImage, Thumbnail,
    GenerationState, MediaState, PromptState
)
from app.models.schemas import (
    ImagePromptResponse, ImagePromptUpdate,
    CharacterRefResponse, LocationRefResponse,
    GeneratedImageResponse, ThumbnailResponse,
    RefPromptUpdate, ThumbnailPromptUpdate
)
from app.services.generator import generator, OUTPUTS_DIR

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}", tags=["images"])


# ============================================================================
# STEP 6: IMAGE PROMPTS
# ============================================================================

@router.get("/image-prompts", response_model=List[ImagePromptResponse])
def list_image_prompts(project_id: str, db: Session = Depends(get_db)):
    """List all image prompts for project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    prompts = []
    for episode in sorted(project.episodes, key=lambda e: e.episode_number):
        for scene in sorted(episode.scenes, key=lambda s: s.scene_number):
            for prompt in sorted(scene.image_prompts, key=lambda p: p.shot_number):
                prompts.append(prompt)
    return prompts


@router.post("/image-prompts/generate")
async def generate_image_prompts(project_id: str, db: Session = Depends(get_db)):
    """Generate image prompts for all scenes (Step 6) — batched per episode"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check prerequisites - need generated episodes
    generated_episodes = [e for e in project.episodes if e.state in [GenerationState.GENERATED, GenerationState.APPROVED]]
    if not generated_episodes:
        raise HTTPException(status_code=400, detail="Generate episode scripts first")

    characters_data = [
        {"name": c.name, "physical_description": c.physical_description}
        for c in project.characters
    ]

    prompts_created = 0

    for episode in sorted(generated_episodes, key=lambda e: e.episode_number):
        # Collect scenes that still need image prompts
        scenes_needing_prompts = [s for s in episode.scenes if not s.image_prompts]
        if not scenes_needing_prompts:
            continue

        # Build scene data with locations for the batch prompt
        scenes_data = []
        for scene in sorted(scenes_needing_prompts, key=lambda s: s.scene_number):
            location_data = {}
            if scene.location:
                location_data = {
                    "name": scene.location.name,
                    "visual_details": scene.location.visual_details,
                    "mood": scene.location.mood
                }
            scenes_data.append({
                "scene_number": scene.scene_number,
                "title": scene.title,
                "mood": scene.mood,
                "action_beats": scene.action_beats or [],
                "location": location_data
            })

        # 1 AI call per episode (instead of 1 per scene)
        logger.info(f"Generating image prompts for episode {episode.episode_number} ({len(scenes_data)} scenes)")
        result = await generator.generate_episode_image_prompts(
            episode_title=episode.title or f"Episode {episode.episode_number}",
            scenes=scenes_data,
            characters=characters_data
        )

        # Map shots back to the correct scene DB objects
        scene_map = {s.scene_number: s for s in scenes_needing_prompts}

        for scene_result in result:
            scene_num = scene_result.get("scene_number")
            scene_obj = scene_map.get(scene_num)
            if not scene_obj:
                logger.warning(f"AI returned scene_number {scene_num} not found in episode {episode.episode_number}, skipping")
                continue

            for shot in scene_result.get("shots", []):
                prompt = ImagePrompt(
                    scene_id=scene_obj.id,
                    shot_number=shot.get("shot_number", 1),
                    shot_type=shot.get("shot_type", "medium"),
                    description=shot.get("description", ""),
                    prompt_text=shot.get("prompt_text", ""),
                    negative_prompt=shot.get("negative_prompt", ""),
                    state=PromptState.GENERATED
                )
                db.add(prompt)
                prompts_created += 1

    # Update step
    if project.current_step < 6:
        project.current_step = 6

    db.commit()

    return {
        "status": "generated",
        "prompts_created": prompts_created
    }


# Image prompt-level routes
image_prompt_router = APIRouter(prefix="/image-prompts", tags=["images"])


@image_prompt_router.get("/{prompt_id}", response_model=ImagePromptResponse)
def get_image_prompt(prompt_id: str, db: Session = Depends(get_db)):
    """Get an image prompt"""
    prompt = db.query(ImagePrompt).filter(ImagePrompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Image prompt not found")
    return prompt


@image_prompt_router.put("/{prompt_id}", response_model=ImagePromptResponse)
def update_image_prompt(prompt_id: str, data: ImagePromptUpdate, db: Session = Depends(get_db)):
    """Update an image prompt"""
    prompt = db.query(ImagePrompt).filter(ImagePrompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Image prompt not found")
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(prompt, field, value)
    
    db.commit()
    db.refresh(prompt)
    return prompt


@image_prompt_router.post("/{prompt_id}/approve")
def approve_image_prompt(prompt_id: str, db: Session = Depends(get_db)):
    """Approve an image prompt"""
    prompt = db.query(ImagePrompt).filter(ImagePrompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Image prompt not found")
    
    prompt.approve()
    db.commit()
    return {"status": "approved"}


# ============================================================================
# STEP 7: REFERENCE IMAGES
# ============================================================================

@router.get("/character-refs", response_model=List[CharacterRefResponse])
def list_character_refs(project_id: str, db: Session = Depends(get_db)):
    """List character reference images"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return [c.reference for c in project.characters if c.reference]


@router.get("/location-refs", response_model=List[LocationRefResponse])
def list_location_refs(project_id: str, db: Session = Depends(get_db)):
    """List location reference images"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return [l.reference for l in project.locations if l.reference]


@router.post("/references/generate")
async def generate_reference_prompts(project_id: str, db: Session = Depends(get_db)):
    """Generate prompts for character and location reference images (Step 7)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    refs_created = 0
    
    # Generate character reference prompts
    for character in project.characters:
        if character.reference:
            continue  # Skip if already has reference
        
        prompt_text = await generator.generate_character_ref_prompt({
            "name": character.name,
            "physical_description": character.physical_description,
            "personality": character.personality,
            "role": character.role
        })
        
        ref = CharacterRef(
            character_id=character.id,
            prompt_text=prompt_text,
            state=MediaState.PENDING
        )
        db.add(ref)
        refs_created += 1
    
    # Generate location reference prompts
    for location in project.locations:
        if location.reference:
            continue
        
        prompt_text = await generator.generate_location_ref_prompt({
            "name": location.name,
            "type": location.type,
            "description": location.description,
            "visual_details": location.visual_details,
            "mood": location.mood
        })
        
        ref = LocationRef(
            location_id=location.id,
            prompt_text=prompt_text,
            state=MediaState.PENDING
        )
        db.add(ref)
        refs_created += 1
    
    # Update step
    if project.current_step < 7:
        project.current_step = 7
    
    db.commit()
    
    return {
        "status": "generated",
        "refs_created": refs_created
    }


# Character ref routes
character_ref_router = APIRouter(prefix="/character-refs", tags=["images"])


@character_ref_router.put("/{ref_id}/prompt", response_model=CharacterRefResponse)
def update_character_ref_prompt(ref_id: str, data: RefPromptUpdate, db: Session = Depends(get_db)):
    """Update character reference prompt"""
    ref = db.query(CharacterRef).filter(CharacterRef.id == ref_id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Character reference not found")
    
    ref.prompt_text = data.prompt_text
    db.commit()
    db.refresh(ref)
    return ref


@character_ref_router.post("/{ref_id}/approve")
def approve_character_ref(ref_id: str, db: Session = Depends(get_db)):
    """Approve character reference image"""
    ref = db.query(CharacterRef).filter(CharacterRef.id == ref_id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Character reference not found")
    
    if ref.state != MediaState.GENERATED:
        raise HTTPException(status_code=400, detail="Image not yet generated")
    
    ref.approve()
    db.commit()
    return {"status": "approved"}


@character_ref_router.post("/{ref_id}/reject")
def reject_character_ref(ref_id: str, db: Session = Depends(get_db)):
    """Reject character reference image"""
    ref = db.query(CharacterRef).filter(CharacterRef.id == ref_id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Character reference not found")
    
    ref.reject()
    db.commit()
    return {"status": "rejected"}


@character_ref_router.post("/{ref_id}/regenerate")
async def regenerate_character_ref(ref_id: str, db: Session = Depends(get_db)):
    """Regenerate character reference image"""
    ref = db.query(CharacterRef).filter(CharacterRef.id == ref_id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Character reference not found")

    ref.reset_for_regen()
    ref.mark_generating()
    db.flush()

    save_path = os.path.join(
        OUTPUTS_DIR, "refs", f"char_{ref.character_id}.png"
    )

    try:
        await generator.generate_image(ref.prompt_text, save_path, "3:4")
        rel_path = os.path.relpath(save_path, OUTPUTS_DIR)
        ref.mark_generated(f"/outputs/{rel_path.replace(os.sep, '/')}")
        db.commit()
        return {"status": "regenerated"}
    except Exception as e:
        db.commit()
        raise HTTPException(status_code=500, detail=f"Regeneration failed: {str(e)}")


# Location ref routes
location_ref_router = APIRouter(prefix="/location-refs", tags=["images"])


@location_ref_router.put("/{ref_id}/prompt", response_model=LocationRefResponse)
def update_location_ref_prompt(ref_id: str, data: RefPromptUpdate, db: Session = Depends(get_db)):
    """Update location reference prompt"""
    ref = db.query(LocationRef).filter(LocationRef.id == ref_id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Location reference not found")
    
    ref.prompt_text = data.prompt_text
    db.commit()
    db.refresh(ref)
    return ref


@location_ref_router.post("/{ref_id}/approve")
def approve_location_ref(ref_id: str, db: Session = Depends(get_db)):
    """Approve location reference image"""
    ref = db.query(LocationRef).filter(LocationRef.id == ref_id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Location reference not found")
    
    if ref.state != MediaState.GENERATED:
        raise HTTPException(status_code=400, detail="Image not yet generated")
    
    ref.approve()
    db.commit()
    return {"status": "approved"}


@location_ref_router.post("/{ref_id}/reject")
def reject_location_ref(ref_id: str, db: Session = Depends(get_db)):
    """Reject location reference image"""
    ref = db.query(LocationRef).filter(LocationRef.id == ref_id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Location reference not found")
    
    ref.reject()
    db.commit()
    return {"status": "rejected"}


@location_ref_router.post("/{ref_id}/regenerate")
async def regenerate_location_ref(ref_id: str, db: Session = Depends(get_db)):
    """Regenerate location reference image"""
    ref = db.query(LocationRef).filter(LocationRef.id == ref_id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Location reference not found")

    ref.reset_for_regen()
    ref.mark_generating()
    db.flush()

    save_path = os.path.join(
        OUTPUTS_DIR, "refs", f"loc_{ref.location_id}.png"
    )

    try:
        await generator.generate_image(ref.prompt_text, save_path, "16:9")
        rel_path = os.path.relpath(save_path, OUTPUTS_DIR)
        ref.mark_generated(f"/outputs/{rel_path.replace(os.sep, '/')}")
        db.commit()
        return {"status": "regenerated"}
    except Exception as e:
        db.commit()
        raise HTTPException(status_code=500, detail=f"Regeneration failed: {str(e)}")


# ============================================================================
# STEP 8: GENERATE IMAGES (placeholder - needs Imagen 3 integration)
# ============================================================================

@router.post("/images/generate")
async def generate_images(project_id: str, db: Session = Depends(get_db)):
    """Generate images from approved prompts (Step 8) using Gemini 3 Pro"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    images_created = 0
    errors = []

    for episode in project.episodes:
        for scene in episode.scenes:
            for prompt in scene.image_prompts:
                if prompt.state == PromptState.APPROVED and not prompt.generated_image:
                    image = GeneratedImage(
                        image_prompt_id=prompt.id,
                        state=MediaState.GENERATING
                    )
                    db.add(image)
                    db.flush()

                    # Map shot type to aspect ratio
                    shot_type = (prompt.shot_type or "medium").lower()
                    if shot_type in ("wide", "establishing"):
                        aspect_ratio = "16:9"
                    else:
                        aspect_ratio = "9:16"

                    save_path = os.path.join(
                        OUTPUTS_DIR, "images",
                        f"scene_{scene.id}_{prompt.shot_number}.png"
                    )

                    try:
                        await generator.generate_image(
                            prompt.prompt_text, save_path, aspect_ratio
                        )
                        # Store path relative to outputs dir for URL serving
                        rel_path = os.path.relpath(save_path, OUTPUTS_DIR)
                        image.mark_generated(f"/outputs/{rel_path.replace(os.sep, '/')}")
                        images_created += 1
                    except Exception as e:
                        logger.error(f"Image generation failed for prompt {prompt.id}: {e}")
                        errors.append({"prompt_id": prompt.id, "error": str(e)})

    # Update step
    if project.current_step < 8:
        project.current_step = 8

    db.commit()

    return {
        "status": "generated",
        "images_created": images_created,
        "errors": errors
    }


@router.post("/references/generate-images")
async def generate_reference_images(project_id: str, db: Session = Depends(get_db)):
    """Generate reference images using Gemini 3 Pro"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    refs_generated = 0
    errors = []

    # Generate character reference images (portrait 3:4)
    for char in project.characters:
        if char.reference and char.reference.state == MediaState.PENDING:
            char.reference.mark_generating()
            db.flush()

            save_path = os.path.join(
                OUTPUTS_DIR, "refs", f"char_{char.id}.png"
            )

            try:
                await generator.generate_image(
                    char.reference.prompt_text, save_path, "3:4"
                )
                rel_path = os.path.relpath(save_path, OUTPUTS_DIR)
                char.reference.mark_generated(f"/outputs/{rel_path.replace(os.sep, '/')}")
                refs_generated += 1
            except Exception as e:
                logger.error(f"Character ref generation failed for {char.name}: {e}")
                errors.append({"character": char.name, "error": str(e)})

    # Generate location reference images (landscape 16:9)
    for loc in project.locations:
        if loc.reference and loc.reference.state == MediaState.PENDING:
            loc.reference.mark_generating()
            db.flush()

            save_path = os.path.join(
                OUTPUTS_DIR, "refs", f"loc_{loc.id}.png"
            )

            try:
                await generator.generate_image(
                    loc.reference.prompt_text, save_path, "16:9"
                )
                rel_path = os.path.relpath(save_path, OUTPUTS_DIR)
                loc.reference.mark_generated(f"/outputs/{rel_path.replace(os.sep, '/')}")
                refs_generated += 1
            except Exception as e:
                logger.error(f"Location ref generation failed for {loc.name}: {e}")
                errors.append({"location": loc.name, "error": str(e)})

    db.commit()

    return {
        "status": "generated",
        "refs_generated": refs_generated,
        "errors": errors
    }


# ============================================================================
# STEP 9: THUMBNAILS
# ============================================================================

@router.get("/thumbnails", response_model=List[ThumbnailResponse])
def list_thumbnails(project_id: str, db: Session = Depends(get_db)):
    """List all thumbnails"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project.thumbnails


@router.post("/thumbnails/generate")
async def generate_thumbnails(project_id: str, db: Session = Depends(get_db)):
    """Generate thumbnail prompts and images for all episodes (Step 9)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    characters_data = [
        {
            "name": c.name,
            "role": c.role,
            "physical_description": c.physical_description
        }
        for c in project.characters
    ]

    thumbnails_created = 0
    errors = []

    for episode in project.episodes:
        # Check if thumbnails already exist for this episode
        existing = [t for t in project.thumbnails if t.episode_id == episode.id]
        if existing:
            continue

        episode_data = {
            "episode_number": episode.episode_number,
            "title": episode.title,
            "cliffhanger_moment": episode.cliffhanger_moment
        }

        thumb_prompts = await generator.generate_thumbnail_prompts(
            episode=episode_data,
            characters=characters_data
        )

        for thumb_data in thumb_prompts:
            orientation = thumb_data.get("orientation", "horizontal")
            thumb = Thumbnail(
                project_id=project_id,
                episode_id=episode.id,
                orientation=orientation,
                prompt_text=thumb_data.get("prompt_text", ""),
                state=MediaState.GENERATING
            )
            db.add(thumb)
            db.flush()

            # Generate the actual thumbnail image
            aspect_ratio = "9:16" if orientation == "vertical" else "16:9"
            save_path = os.path.join(
                OUTPUTS_DIR, "thumbnails",
                f"ep_{episode.episode_number}_{orientation}.png"
            )

            try:
                await generator.generate_image(
                    thumb.prompt_text, save_path, aspect_ratio
                )
                rel_path = os.path.relpath(save_path, OUTPUTS_DIR)
                thumb.mark_generated(f"/outputs/{rel_path.replace(os.sep, '/')}")
                thumbnails_created += 1
            except Exception as e:
                logger.error(f"Thumbnail generation failed for ep {episode.episode_number} {orientation}: {e}")
                errors.append({
                    "episode": episode.episode_number,
                    "orientation": orientation,
                    "error": str(e)
                })

    # Update step
    if project.current_step < 9:
        project.current_step = 9

    db.commit()

    return {
        "status": "generated",
        "thumbnails_created": thumbnails_created,
        "errors": errors
    }


# Thumbnail-level routes
thumbnail_router = APIRouter(prefix="/thumbnails", tags=["images"])


@thumbnail_router.put("/{thumb_id}/prompt", response_model=ThumbnailResponse)
def update_thumbnail_prompt(thumb_id: str, data: ThumbnailPromptUpdate, db: Session = Depends(get_db)):
    """Update thumbnail prompt"""
    thumb = db.query(Thumbnail).filter(Thumbnail.id == thumb_id).first()
    if not thumb:
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    
    thumb.prompt_text = data.prompt_text
    db.commit()
    db.refresh(thumb)
    return thumb


@thumbnail_router.post("/{thumb_id}/approve")
def approve_thumbnail(thumb_id: str, db: Session = Depends(get_db)):
    """Approve thumbnail"""
    thumb = db.query(Thumbnail).filter(Thumbnail.id == thumb_id).first()
    if not thumb:
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    
    thumb.approve()
    db.commit()
    return {"status": "approved"}


@thumbnail_router.post("/{thumb_id}/reject")
def reject_thumbnail(thumb_id: str, db: Session = Depends(get_db)):
    """Reject thumbnail"""
    thumb = db.query(Thumbnail).filter(Thumbnail.id == thumb_id).first()
    if not thumb:
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    
    thumb.reject()
    db.commit()
    return {"status": "rejected"}


@thumbnail_router.post("/{thumb_id}/regenerate")
async def regenerate_thumbnail(thumb_id: str, db: Session = Depends(get_db)):
    """Regenerate thumbnail image"""
    thumb = db.query(Thumbnail).filter(Thumbnail.id == thumb_id).first()
    if not thumb:
        raise HTTPException(status_code=404, detail="Thumbnail not found")

    thumb.reset_for_regen()
    thumb.mark_generating()
    db.flush()

    aspect_ratio = "9:16" if thumb.orientation == "vertical" else "16:9"
    ep_num = thumb.episode.episode_number if thumb.episode else "unknown"
    save_path = os.path.join(
        OUTPUTS_DIR, "thumbnails",
        f"ep_{ep_num}_{thumb.orientation}.png"
    )

    try:
        await generator.generate_image(thumb.prompt_text, save_path, aspect_ratio)
        rel_path = os.path.relpath(save_path, OUTPUTS_DIR)
        thumb.mark_generated(f"/outputs/{rel_path.replace(os.sep, '/')}")
        db.commit()
        return {"status": "regenerated"}
    except Exception as e:
        db.commit()
        raise HTTPException(status_code=500, detail=f"Regeneration failed: {str(e)}")


# ============================================================================
# STEP 10: REVIEW IMAGES
# ============================================================================

@router.get("/images/review")
def get_images_for_review(project_id: str, db: Session = Depends(get_db)):
    """Get all images pending review (Step 10)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    pending_images = []
    approved_images = []
    rejected_images = []
    
    # Scene images
    for episode in project.episodes:
        for scene in episode.scenes:
            for prompt in scene.image_prompts:
                if prompt.generated_image:
                    img_data = {
                        "id": prompt.generated_image.id,
                        "type": "scene_image",
                        "episode_number": episode.episode_number,
                        "scene_number": scene.scene_number,
                        "shot_number": prompt.shot_number,
                        "description": prompt.description,
                        "image_path": prompt.generated_image.image_path,
                        "state": prompt.generated_image.state.value
                    }
                    if prompt.generated_image.state == MediaState.GENERATED:
                        pending_images.append(img_data)
                    elif prompt.generated_image.state == MediaState.APPROVED:
                        approved_images.append(img_data)
                    elif prompt.generated_image.state == MediaState.REJECTED:
                        rejected_images.append(img_data)
    
    # Character refs
    for char in project.characters:
        if char.reference:
            ref_data = {
                "id": char.reference.id,
                "type": "character_ref",
                "name": char.name,
                "image_path": char.reference.image_path,
                "state": char.reference.state.value
            }
            if char.reference.state == MediaState.GENERATED:
                pending_images.append(ref_data)
            elif char.reference.state == MediaState.APPROVED:
                approved_images.append(ref_data)
            elif char.reference.state == MediaState.REJECTED:
                rejected_images.append(ref_data)
    
    # Location refs
    for loc in project.locations:
        if loc.reference:
            ref_data = {
                "id": loc.reference.id,
                "type": "location_ref",
                "name": loc.name,
                "image_path": loc.reference.image_path,
                "state": loc.reference.state.value
            }
            if loc.reference.state == MediaState.GENERATED:
                pending_images.append(ref_data)
            elif loc.reference.state == MediaState.APPROVED:
                approved_images.append(ref_data)
            elif loc.reference.state == MediaState.REJECTED:
                rejected_images.append(ref_data)
    
    # Thumbnails
    for thumb in project.thumbnails:
        thumb_data = {
            "id": thumb.id,
            "type": "thumbnail",
            "episode_id": thumb.episode_id,
            "orientation": thumb.orientation,
            "image_path": thumb.image_path,
            "state": thumb.state.value
        }
        if thumb.state == MediaState.GENERATED:
            pending_images.append(thumb_data)
        elif thumb.state == MediaState.APPROVED:
            approved_images.append(thumb_data)
        elif thumb.state == MediaState.REJECTED:
            rejected_images.append(thumb_data)
    
    return {
        "pending": pending_images,
        "approved": approved_images,
        "rejected": rejected_images,
        "total_pending": len(pending_images),
        "total_approved": len(approved_images),
        "total_rejected": len(rejected_images)
    }


# Generated image routes
generated_image_router = APIRouter(prefix="/generated-images", tags=["images"])


@generated_image_router.post("/{image_id}/approve")
def approve_generated_image(image_id: str, db: Session = Depends(get_db)):
    """Approve generated image"""
    image = db.query(GeneratedImage).filter(GeneratedImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    image.approve()
    db.commit()
    return {"status": "approved"}


@generated_image_router.post("/{image_id}/reject")
def reject_generated_image(image_id: str, db: Session = Depends(get_db)):
    """Reject generated image"""
    image = db.query(GeneratedImage).filter(GeneratedImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    image.reject()
    db.commit()
    return {"status": "rejected"}


@generated_image_router.post("/{image_id}/regenerate")
async def regenerate_generated_image(image_id: str, db: Session = Depends(get_db)):
    """Regenerate a scene image"""
    image = db.query(GeneratedImage).filter(GeneratedImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    prompt = image.image_prompt
    image.reset_for_regen()
    image.mark_generating()
    db.flush()

    shot_type = (prompt.shot_type or "medium").lower()
    if shot_type in ("wide", "establishing"):
        aspect_ratio = "16:9"
    else:
        aspect_ratio = "9:16"

    save_path = os.path.join(
        OUTPUTS_DIR, "images",
        f"scene_{prompt.scene_id}_{prompt.shot_number}.png"
    )

    try:
        await generator.generate_image(prompt.prompt_text, save_path, aspect_ratio)
        rel_path = os.path.relpath(save_path, OUTPUTS_DIR)
        image.mark_generated(f"/outputs/{rel_path.replace(os.sep, '/')}")
        db.commit()
        return {"status": "regenerated"}
    except Exception as e:
        db.commit()
        raise HTTPException(status_code=500, detail=f"Regeneration failed: {str(e)}")
