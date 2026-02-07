"""
Episodes API routes (Step 5)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database.session import get_db
from app.models.models import (
    Project, Episode, Scene, DialogueLine, EpisodeSummary, Character, Location,
    GenerationState, StructureState
)
from app.models.schemas import (
    EpisodeResponse, EpisodeDetail, SceneResponse, DialogueLineResponse,
    GenerateEpisodesRequest
)
from app.services.generator import generator

router = APIRouter(prefix="/projects/{project_id}/episodes", tags=["episodes"])


@router.get("", response_model=List[EpisodeResponse])
def list_episodes(project_id: str, db: Session = Depends(get_db)):
    """List all generated episodes"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    episodes = sorted(project.episodes, key=lambda x: x.episode_number)
    return [_episode_to_response(ep) for ep in episodes]


@router.post("/generate")
async def generate_episodes(
    project_id: str,
    request: GenerateEpisodesRequest = None,
    db: Session = Depends(get_db)
):
    """Generate next batch of episode scripts (Step 5)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check prerequisites
    if not all(c.state == StructureState.APPROVED for c in project.characters):
        raise HTTPException(status_code=400, detail="All characters must be approved first")
    if not all(l.state == StructureState.APPROVED for l in project.locations):
        raise HTTPException(status_code=400, detail="All locations must be approved first")
    if not all(e.state == StructureState.APPROVED for e in project.episode_summaries):
        raise HTTPException(status_code=400, detail="All episode summaries must be approved first")
    
    batch_size = request.batch_size if request else 5
    
    # Find which episodes still need to be generated
    generated_numbers = {ep.episode_number for ep in project.episodes if ep.state != GenerationState.PENDING}
    summaries_to_generate = [
        s for s in sorted(project.episode_summaries, key=lambda x: x.episode_number)
        if s.episode_number not in generated_numbers
    ][:batch_size]
    
    if not summaries_to_generate:
        raise HTTPException(status_code=400, detail="All episodes have been generated")
    
    # Get character and location data for generation
    characters_data = [
        {
            "name": c.name,
            "role": c.role,
            "physical_description": c.physical_description,
            "personality": c.personality
        }
        for c in project.characters
    ]
    
    locations_data = [
        {
            "name": l.name,
            "type": l.type,
            "description": l.description,
            "visual_details": l.visual_details
        }
        for l in project.locations
    ]
    
    # Get previous episodes for context
    previous_episodes = [
        {
            "episode_number": ep.episode_number,
            "title": ep.title,
            "summary": next(
                (s.summary for s in project.episode_summaries if s.episode_number == ep.episode_number),
                ""
            )
        }
        for ep in sorted(project.episodes, key=lambda x: x.episode_number)
        if ep.state in [GenerationState.GENERATED, GenerationState.APPROVED]
    ]
    
    generated_episodes = []
    
    for summary in summaries_to_generate:
        # Check if episode already exists (in pending state)
        existing = db.query(Episode).filter(
            Episode.project_id == project_id,
            Episode.episode_number == summary.episode_number
        ).first()
        
        if existing:
            episode = existing
        else:
            episode = Episode(
                project_id=project_id,
                episode_number=summary.episode_number,
                state=GenerationState.GENERATING
            )
            db.add(episode)
            db.flush()
        
        episode.mark_generating()
        db.flush()
        
        # Generate script
        summary_data = {
            "episode_number": summary.episode_number,
            "title": summary.title,
            "summary": summary.summary,
            "key_beats": summary.key_beats or [],
            "cliffhanger": summary.cliffhanger
        }
        
        script_data = await generator.generate_episode_script(
            episode_summary=summary_data,
            characters=characters_data,
            locations=locations_data,
            previous_episodes=previous_episodes if previous_episodes else None
        )
        
        # Update episode with generated data
        episode.title = script_data.get("title", summary.title)
        episode.cold_open = script_data.get("cold_open", "")
        episode.music_cue = script_data.get("music_cue", "")
        episode.cliffhanger_moment = script_data.get("cliffhanger_moment", "")
        
        # Clear existing scenes if regenerating
        for scene in episode.scenes:
            db.delete(scene)
        db.flush()
        
        # Create scenes
        for scene_data in script_data.get("scenes", []):
            # Find location
            location = next(
                (l for l in project.locations if l.name.lower() == scene_data.get("location", "").lower()),
                None
            )
            
            scene = Scene(
                episode_id=episode.id,
                location_id=location.id if location else None,
                scene_number=scene_data.get("scene_number", 1),
                title=scene_data.get("title", ""),
                duration_seconds=scene_data.get("duration_seconds", 15),
                time_of_day=scene_data.get("time_of_day", "day"),
                mood=scene_data.get("mood", "dramatic"),
                action_beats=scene_data.get("action_beats", []),
                camera_notes=scene_data.get("camera_notes", "")
            )
            db.add(scene)
            db.flush()
            
            # Create dialogue lines
            for i, line_data in enumerate(scene_data.get("dialogue", [])):
                # Find character
                char_name = line_data.get("character", "")
                character = next(
                    (c for c in project.characters if c.name.lower() == char_name.lower()),
                    None
                )
                
                dialogue = DialogueLine(
                    scene_id=scene.id,
                    character_id=character.id if character else None,
                    character_name=char_name,
                    line_number=i + 1,
                    line_text=line_data.get("line", ""),
                    direction=line_data.get("direction", ""),
                    emotion=line_data.get("emotion", "")
                )
                db.add(dialogue)
        
        episode.mark_generated()
        generated_episodes.append(episode)
        
        # Add to previous episodes for next iteration context
        previous_episodes.append({
            "episode_number": episode.episode_number,
            "title": episode.title,
            "summary": summary.summary
        })
    
    # Update project step
    if project.current_step < 5:
        project.current_step = 5
    
    db.commit()
    
    return {
        "status": "generated",
        "episodes_generated": len(generated_episodes),
        "episode_numbers": [ep.episode_number for ep in generated_episodes],
        "remaining": project.num_episodes - len([e for e in project.episodes if e.state != GenerationState.PENDING])
    }


# Episode-level routes
episode_router = APIRouter(prefix="/episodes", tags=["episodes"])


@episode_router.get("/{episode_id}", response_model=EpisodeDetail)
def get_episode(episode_id: str, db: Session = Depends(get_db)):
    """Get full episode with scenes and dialogue"""
    episode = db.query(Episode).filter(Episode.id == episode_id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    
    return _episode_to_detail(episode)


@episode_router.post("/{episode_id}/approve")
def approve_episode(episode_id: str, db: Session = Depends(get_db)):
    """Approve an episode"""
    episode = db.query(Episode).filter(Episode.id == episode_id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    
    episode.approve()
    db.commit()
    return {"status": "approved", "episode_id": episode_id}


def _episode_to_response(episode: Episode) -> EpisodeResponse:
    """Convert Episode to response schema"""
    return EpisodeResponse(
        id=episode.id,
        project_id=episode.project_id,
        episode_number=episode.episode_number,
        title=episode.title,
        cold_open=episode.cold_open,
        music_cue=episode.music_cue,
        cliffhanger_moment=episode.cliffhanger_moment,
        state=episode.state,
        scenes_count=len(episode.scenes),
        created_at=episode.created_at
    )


def _episode_to_detail(episode: Episode) -> EpisodeDetail:
    """Convert Episode to detailed response with scenes"""
    scenes = []
    for scene in sorted(episode.scenes, key=lambda s: s.scene_number):
        dialogue_lines = [
            DialogueLineResponse(
                id=d.id,
                scene_id=d.scene_id,
                character_id=d.character_id,
                character_name=d.character_name,
                line_number=d.line_number,
                line_text=d.line_text,
                direction=d.direction,
                emotion=d.emotion
            )
            for d in sorted(scene.dialogue_lines, key=lambda d: d.line_number)
        ]
        
        scenes.append(SceneResponse(
            id=scene.id,
            episode_id=scene.episode_id,
            location_id=scene.location_id,
            scene_number=scene.scene_number,
            title=scene.title,
            duration_seconds=scene.duration_seconds,
            time_of_day=scene.time_of_day,
            mood=scene.mood,
            action_beats=scene.action_beats,
            camera_notes=scene.camera_notes,
            dialogue_lines=dialogue_lines,
            image_prompts_count=len(scene.image_prompts),
            video_prompts_count=len(scene.video_prompts)
        ))
    
    return EpisodeDetail(
        id=episode.id,
        project_id=episode.project_id,
        episode_number=episode.episode_number,
        title=episode.title,
        cold_open=episode.cold_open,
        music_cue=episode.music_cue,
        cliffhanger_moment=episode.cliffhanger_moment,
        state=episode.state,
        scenes_count=len(episode.scenes),
        created_at=episode.created_at,
        scenes=scenes
    )
