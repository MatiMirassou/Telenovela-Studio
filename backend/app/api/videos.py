"""
Videos API routes (Steps 11, 12)
- Step 11: Generate Video Prompts
- Step 12: Generate Videos
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import os
import logging

from app.database.session import get_db
from app.models.models import (
    Project, Episode, Scene, VideoPrompt, GeneratedVideo,
    GenerationState, MediaState, PromptState
)
from app.models.schemas import (
    VideoPromptResponse, VideoPromptUpdate, GeneratedVideoResponse
)
from app.services.generator import generator, OUTPUTS_DIR

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}", tags=["videos"])


# ============================================================================
# STEP 11: VIDEO PROMPTS
# ============================================================================

@router.get("/video-prompts", response_model=List[VideoPromptResponse])
def list_video_prompts(project_id: str, db: Session = Depends(get_db)):
    """List all video prompts for project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    prompts = []
    for episode in sorted(project.episodes, key=lambda e: e.episode_number):
        for scene in sorted(episode.scenes, key=lambda s: s.scene_number):
            for prompt in sorted(scene.video_prompts, key=lambda p: p.segment_number):
                prompts.append(prompt)
    return prompts


@router.post("/video-prompts/generate")
async def generate_video_prompts(project_id: str, db: Session = Depends(get_db)):
    """Generate video prompts for all scenes (Step 11)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    characters_data = [
        {"name": c.name, "physical_description": c.physical_description}
        for c in project.characters
    ]
    
    prompts_created = 0
    
    for episode in project.episodes:
        for scene in episode.scenes:
            # Skip if already has video prompts
            if scene.video_prompts:
                continue
            
            # Get location data
            location_data = {}
            if scene.location:
                location_data = {
                    "name": scene.location.name,
                    "visual_details": scene.location.visual_details
                }
            
            scene_data = {
                "title": scene.title,
                "duration_seconds": scene.duration_seconds,
                "mood": scene.mood,
                "action_beats": scene.action_beats or []
            }
            
            # Get existing image prompts for reference
            image_prompts_data = [
                {
                    "shot_number": p.shot_number,
                    "description": p.description,
                    "prompt_text": p.prompt_text
                }
                for p in scene.image_prompts
            ]
            
            # Generate video prompts
            prompts_data = await generator.generate_video_prompts(
                scene=scene_data,
                image_prompts=image_prompts_data,
                characters=characters_data,
                location=location_data
            )
            
            for prompt_data in prompts_data:
                # Find reference image if specified
                ref_shot = prompt_data.get("reference_image_shot")
                ref_image_id = None
                if ref_shot:
                    for img_prompt in scene.image_prompts:
                        if img_prompt.shot_number == ref_shot and img_prompt.generated_image:
                            ref_image_id = img_prompt.generated_image.id
                            break
                
                prompt = VideoPrompt(
                    scene_id=scene.id,
                    segment_number=prompt_data.get("segment_number", 1),
                    prompt_text=prompt_data.get("prompt_text", ""),
                    duration_seconds=prompt_data.get("duration_seconds", 5),
                    camera_movement=prompt_data.get("camera_movement", "static"),
                    reference_image_id=ref_image_id,
                    state=PromptState.GENERATED
                )
                db.add(prompt)
                prompts_created += 1
    
    # Update step
    if project.current_step < 11:
        project.current_step = 11
    
    db.commit()
    
    return {
        "status": "generated",
        "prompts_created": prompts_created
    }


# Video prompt-level routes
video_prompt_router = APIRouter(prefix="/video-prompts", tags=["videos"])


@video_prompt_router.get("/{prompt_id}", response_model=VideoPromptResponse)
def get_video_prompt(prompt_id: str, db: Session = Depends(get_db)):
    """Get a video prompt"""
    prompt = db.query(VideoPrompt).filter(VideoPrompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Video prompt not found")
    return prompt


@video_prompt_router.put("/{prompt_id}", response_model=VideoPromptResponse)
def update_video_prompt(prompt_id: str, data: VideoPromptUpdate, db: Session = Depends(get_db)):
    """Update a video prompt"""
    prompt = db.query(VideoPrompt).filter(VideoPrompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Video prompt not found")
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(prompt, field, value)
    
    db.commit()
    db.refresh(prompt)
    return prompt


@video_prompt_router.post("/{prompt_id}/approve")
def approve_video_prompt(prompt_id: str, db: Session = Depends(get_db)):
    """Approve a video prompt"""
    prompt = db.query(VideoPrompt).filter(VideoPrompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Video prompt not found")
    
    prompt.approve()
    db.commit()
    return {"status": "approved"}


# ============================================================================
# STEP 12: GENERATE VIDEOS (placeholder - needs Veo 2 integration)
# ============================================================================

@router.post("/videos/generate")
async def generate_videos(project_id: str, db: Session = Depends(get_db)):
    """Generate videos from approved prompts (Step 12) using Veo 3.1"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    videos_created = 0
    errors = []

    for episode in project.episodes:
        for scene in episode.scenes:
            for prompt in scene.video_prompts:
                if prompt.state == PromptState.APPROVED and not prompt.generated_video:
                    video = GeneratedVideo(
                        video_prompt_id=prompt.id,
                        state=MediaState.GENERATING
                    )
                    db.add(video)
                    db.flush()

                    save_path = os.path.join(
                        OUTPUTS_DIR, "videos",
                        f"scene_{scene.id}_seg_{prompt.segment_number}.mp4"
                    )

                    try:
                        await generator.generate_video(
                            prompt.prompt_text,
                            save_path,
                            duration_seconds=prompt.duration_seconds or 8,
                            aspect_ratio="9:16"
                        )
                        rel_path = os.path.relpath(save_path, OUTPUTS_DIR)
                        video.mark_generated(
                            f"/outputs/{rel_path.replace(os.sep, '/')}",
                            duration=prompt.duration_seconds
                        )
                        videos_created += 1
                    except Exception as e:
                        logger.error(f"Video generation failed for prompt {prompt.id}: {e}")
                        errors.append({"prompt_id": prompt.id, "error": str(e)})

    # Update step
    if project.current_step < 12:
        project.current_step = 12

    db.commit()

    return {
        "status": "generated",
        "videos_created": videos_created,
        "errors": errors
    }


@router.get("/videos", response_model=List[GeneratedVideoResponse])
def list_videos(project_id: str, db: Session = Depends(get_db)):
    """List all generated videos"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    videos = []
    for episode in sorted(project.episodes, key=lambda e: e.episode_number):
        for scene in sorted(episode.scenes, key=lambda s: s.scene_number):
            for prompt in scene.video_prompts:
                if prompt.generated_video:
                    videos.append(prompt.generated_video)
    return videos


# Generated video routes
generated_video_router = APIRouter(prefix="/generated-videos", tags=["videos"])


@generated_video_router.post("/{video_id}/approve")
def approve_generated_video(video_id: str, db: Session = Depends(get_db)):
    """Approve generated video"""
    video = db.query(GeneratedVideo).filter(GeneratedVideo.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    video.approve()
    db.commit()
    return {"status": "approved"}


@generated_video_router.post("/{video_id}/reject")
def reject_generated_video(video_id: str, db: Session = Depends(get_db)):
    """Reject generated video"""
    video = db.query(GeneratedVideo).filter(GeneratedVideo.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    video.reject()
    db.commit()
    return {"status": "rejected"}


@generated_video_router.post("/{video_id}/regenerate")
async def regenerate_generated_video(video_id: str, db: Session = Depends(get_db)):
    """Regenerate a video clip"""
    video = db.query(GeneratedVideo).filter(GeneratedVideo.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    prompt = video.video_prompt
    video.reset_for_regen()
    video.mark_generating()
    db.flush()

    save_path = os.path.join(
        OUTPUTS_DIR, "videos",
        f"scene_{prompt.scene_id}_seg_{prompt.segment_number}.mp4"
    )

    try:
        await generator.generate_video(
            prompt.prompt_text,
            save_path,
            duration_seconds=prompt.duration_seconds or 8,
            aspect_ratio="9:16"
        )
        rel_path = os.path.relpath(save_path, OUTPUTS_DIR)
        video.mark_generated(
            f"/outputs/{rel_path.replace(os.sep, '/')}",
            duration=prompt.duration_seconds
        )
        db.commit()
        return {"status": "regenerated"}
    except Exception as e:
        db.commit()
        raise HTTPException(status_code=500, detail=f"Regeneration failed: {str(e)}")
