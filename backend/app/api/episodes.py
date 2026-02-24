"""
Episodes API routes (Step 5)
"""

import re

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database.session import get_db
from app.models.models import (
    Project, Episode, Scene, DialogueLine, EpisodeSummary, Character, Location,
    GenerationState, StructureState, IdeaState
)
from app.models.schemas import (
    EpisodeResponse, EpisodeDetail, SceneResponse, DialogueLineResponse,
    GenerateEpisodesRequest
)
from app.services.generator import generator
from app.services.script_formatter import format_episode_screenplay
from app.api import parse_state_filter
from app.middleware.rate_limit import limiter, AI_GENERATION_LIMIT

# Episodes per AI call (to stay within token limits)
AI_BATCH_SIZE = 3


def _parse_duration(value) -> int:
    """Parse duration from int or string like '18 seconds' to int"""
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        match = re.search(r'(\d+)', value)
        return int(match.group(1)) if match else 15
    return 15

router = APIRouter(prefix="/projects/{project_id}/episodes", tags=["episodes"])


@router.get("", response_model=List[EpisodeResponse])
def list_episodes(project_id: str, state: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """List all generated episodes. Optional ?state= filter (comma-separated)."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    episodes = project.episodes
    states = parse_state_filter(state)
    if states:
        episodes = [e for e in episodes if e.state.value in states]
    episodes = sorted(episodes, key=lambda x: x.episode_number)
    return [_episode_to_response(ep) for ep in episodes]


@router.post("/generate")
@limiter.limit(AI_GENERATION_LIMIT)
async def generate_episodes(
    request: Request,
    project_id: str,
    body: GenerateEpisodesRequest = None,
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
    
    batch_size = body.batch_size if body else 5
    
    # Find which episodes still need to be generated (include stuck GENERATING ones)
    done_numbers = {ep.episode_number for ep in project.episodes
                    if ep.state not in (GenerationState.PENDING, GenerationState.GENERATING)}
    summaries_to_generate = [
        s for s in sorted(project.episode_summaries, key=lambda x: x.episode_number)
        if s.episode_number not in done_numbers
    ][:batch_size]

    if not summaries_to_generate:
        raise HTTPException(status_code=400, detail="All episodes have been generated")
    
    # Get series title from approved idea
    approved_idea = next((i for i in project.ideas if i.state == IdeaState.APPROVED), None)
    series_title = approved_idea.title if approved_idea else "Untitled"

    # Get character and location data for generation
    characters_data = [
        {
            "name": c.name,
            "role": c.role,
            "archetype": c.archetype,
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

    # Process summaries in chunks for batch AI calls
    for chunk_start in range(0, len(summaries_to_generate), AI_BATCH_SIZE):
        chunk = summaries_to_generate[chunk_start:chunk_start + AI_BATCH_SIZE]

        # Create/prepare Episode DB records for the chunk
        episode_map = {}  # episode_number -> Episode ORM object
        for summary in chunk:
            existing = db.query(Episode).filter(
                Episode.project_id == project_id,
                Episode.episode_number == summary.episode_number
            ).first()

            if existing:
                episode = existing
                if episode.state == GenerationState.GENERATING:
                    episode.reset_for_regen()
            else:
                episode = Episode(
                    project_id=project_id,
                    episode_number=summary.episode_number,
                    state=GenerationState.PENDING
                )
                db.add(episode)
                db.flush()

            episode.mark_generating()
            episode_map[summary.episode_number] = episode
        db.flush()

        # Build summary data for the batch
        chunk_summaries = [
            {
                "episode_number": s.episode_number,
                "title": s.title,
                "summary": s.summary,
                "key_beats": s.key_beats or [],
                "cliffhanger": s.cliffhanger
            }
            for s in chunk
        ]

        # Single AI call for 1-3 episodes
        try:
            scripts_batch = await generator.generate_episode_scripts_batch(
                episode_summaries=chunk_summaries,
                characters=characters_data,
                locations=locations_data,
                series_title=series_title,
                previous_episodes=previous_episodes if previous_episodes else None
            )
        except Exception as e:
            # Rollback all episodes in this chunk to PENDING so retry works
            for ep in episode_map.values():
                ep.reset_for_regen()
            db.flush()
            raise HTTPException(status_code=500, detail=f"Script generation failed: {str(e)}")

        # Process each episode from the batch response
        for script_data in scripts_batch:
            ep_number = script_data.get("episodeNumber", script_data.get("episode_number"))
            if ep_number is None:
                continue

            episode = episode_map.get(ep_number)
            if not episode:
                continue

            summary = next((s for s in chunk if s.episode_number == ep_number), None)
            if not summary:
                continue

            # Update episode with generated data (camelCase with snake_case fallback)
            episode.title = script_data.get("title", summary.title)
            episode.cold_open = script_data.get("coldOpen", script_data.get("cold_open", ""))
            episode.music_cue = script_data.get("musicCue", script_data.get("music_cue", ""))
            episode.cliffhanger_moment = script_data.get("cliffhangerMoment", script_data.get("cliffhanger_moment", ""))

            # Clear existing scenes if regenerating
            for scene in episode.scenes:
                db.delete(scene)
            db.flush()

            # Create scenes
            for scene_data in script_data.get("scenes", []):
                # Find location by name (case-insensitive, with partial match fallback)
                location_name = scene_data.get("location", "")
                location = next(
                    (l for l in project.locations if l.name.lower() == location_name.lower()),
                    None
                )
                if not location and location_name:
                    location = next(
                        (l for l in project.locations
                         if location_name.lower() in l.name.lower() or l.name.lower() in location_name.lower()),
                        None
                    )

                scene = Scene(
                    episode_id=episode.id,
                    location_id=location.id if location else None,
                    scene_number=scene_data.get("sceneNumber", scene_data.get("scene_number", 1)),
                    title=scene_data.get("title", ""),
                    duration_seconds=_parse_duration(scene_data.get("duration", scene_data.get("duration_seconds", 15))),
                    time_of_day=scene_data.get("timeOfDay", scene_data.get("time_of_day", "day")),
                    mood=scene_data.get("mood", "dramatic"),
                    action_beats=scene_data.get("actionBeats", scene_data.get("action_beats", [])),
                    camera_notes=scene_data.get("cameraWork", scene_data.get("camera_notes", ""))
                )
                db.add(scene)
                db.flush()

                # Create dialogue lines
                for i, line_data in enumerate(scene_data.get("dialogue", [])):
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

            # Add to previous episodes for next chunk's context
            previous_episodes.append({
                "episode_number": episode.episode_number,
                "title": episode.title,
                "summary": summary.summary
            })

        # Rollback any episodes that stayed GENERATING (AI didn't return them)
        for ep in episode_map.values():
            if ep.state == GenerationState.GENERATING:
                ep.reset_for_regen()

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


@episode_router.get("/{episode_id}/screenplay")
def get_episode_screenplay(episode_id: str, db: Session = Depends(get_db)):
    """Get episode formatted as a Hollywood screenplay"""
    episode = db.query(Episode).filter(Episode.id == episode_id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    # Build episode data dict for the formatter
    ep_data = {
        "episode_number": episode.episode_number,
        "title": episode.title,
        "cold_open": episode.cold_open,
        "music_cue": episode.music_cue,
        "cliffhanger_moment": episode.cliffhanger_moment,
        "scenes": []
    }

    for scene in sorted(episode.scenes, key=lambda s: s.scene_number):
        scene_data = {
            "scene_number": scene.scene_number,
            "title": scene.title,
            "location_name": scene.location.name if scene.location else "Unknown",
            "location_type": scene.location.type if scene.location else "interior",
            "time_of_day": scene.time_of_day,
            "duration_seconds": scene.duration_seconds,
            "mood": scene.mood,
            "action_beats": scene.action_beats or [],
            "camera_notes": scene.camera_notes or "",
            "dialogue_lines": [
                {
                    "character_name": line.character_name,
                    "line_text": line.line_text,
                    "direction": line.direction,
                    "emotion": line.emotion
                }
                for line in sorted(scene.dialogue_lines, key=lambda d: d.line_number)
            ]
        }
        ep_data["scenes"].append(scene_data)

    screenplay = format_episode_screenplay(ep_data)
    return {"screenplay": screenplay}


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


@episode_router.post("/{episode_id}/unapprove")
def unapprove_episode(episode_id: str, db: Session = Depends(get_db)):
    """Unapprove an episode (revert to generated for re-review)"""
    episode = db.query(Episode).filter(Episode.id == episode_id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    episode.unapprove()
    db.commit()
    return {"status": "unapproved", "episode_id": episode_id}
