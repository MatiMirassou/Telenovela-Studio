"""
Export API routes
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import json
import os
from datetime import datetime

from app.database.session import get_db
from app.models.models import Project

router = APIRouter(prefix="/projects/{project_id}/export", tags=["export"])

OUTPUTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "outputs")


@router.get("")
def export_project(project_id: str, db: Session = Depends(get_db)):
    """Export full project as JSON"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Build export data
    export_data = {
        "meta": {
            "exported_at": datetime.utcnow().isoformat(),
            "project_id": project.id,
            "title": project.title,
            "current_step": project.current_step
        },
        "project": {
            "id": project.id,
            "title": project.title,
            "setting": project.setting,
            "num_episodes": project.num_episodes,
            "current_step": project.current_step,
            "created_at": project.created_at.isoformat(),
            "updated_at": project.updated_at.isoformat()
        },
        "ideas": [
            {
                "id": idea.id,
                "title": idea.title,
                "setting": idea.setting,
                "logline": idea.logline,
                "hook": idea.hook,
                "main_conflict": idea.main_conflict,
                "state": idea.state.value
            }
            for idea in project.ideas
        ],
        "characters": [
            {
                "id": char.id,
                "name": char.name,
                "role": char.role,
                "archetype": char.archetype,
                "age": char.age,
                "physical_description": char.physical_description,
                "personality": char.personality,
                "motivation": char.motivation,
                "secret": char.secret,
                "arc": char.arc,
                "state": char.state.value,
                "reference": {
                    "id": char.reference.id,
                    "prompt_text": char.reference.prompt_text,
                    "image_path": char.reference.image_path,
                    "state": char.reference.state.value
                } if char.reference else None
            }
            for char in project.characters
        ],
        "locations": [
            {
                "id": loc.id,
                "name": loc.name,
                "type": loc.type,
                "description": loc.description,
                "mood": loc.mood,
                "significance": loc.significance,
                "visual_details": loc.visual_details,
                "state": loc.state.value,
                "reference": {
                    "id": loc.reference.id,
                    "prompt_text": loc.reference.prompt_text,
                    "image_path": loc.reference.image_path,
                    "state": loc.reference.state.value
                } if loc.reference else None
            }
            for loc in project.locations
        ],
        "episode_summaries": [
            {
                "id": ep.id,
                "episode_number": ep.episode_number,
                "title": ep.title,
                "summary": ep.summary,
                "key_beats": ep.key_beats,
                "cliffhanger": ep.cliffhanger,
                "emotional_arc": ep.emotional_arc,
                "state": ep.state.value
            }
            for ep in sorted(project.episode_summaries, key=lambda x: x.episode_number)
        ],
        "episodes": [
            {
                "id": episode.id,
                "episode_number": episode.episode_number,
                "title": episode.title,
                "cold_open": episode.cold_open,
                "music_cue": episode.music_cue,
                "cliffhanger_moment": episode.cliffhanger_moment,
                "state": episode.state.value,
                "scenes": [
                    {
                        "id": scene.id,
                        "scene_number": scene.scene_number,
                        "title": scene.title,
                        "location": scene.location.name if scene.location else None,
                        "time_of_day": scene.time_of_day,
                        "duration_seconds": scene.duration_seconds,
                        "mood": scene.mood,
                        "action_beats": scene.action_beats,
                        "camera_notes": scene.camera_notes,
                        "dialogue": [
                            {
                                "character": line.character_name,
                                "line": line.line_text,
                                "direction": line.direction,
                                "emotion": line.emotion
                            }
                            for line in sorted(scene.dialogue_lines, key=lambda x: x.line_number)
                        ],
                        "image_prompts": [
                            {
                                "id": prompt.id,
                                "shot_number": prompt.shot_number,
                                "shot_type": prompt.shot_type,
                                "description": prompt.description,
                                "prompt_text": prompt.prompt_text,
                                "negative_prompt": prompt.negative_prompt,
                                "state": prompt.state.value,
                                "generated_image": {
                                    "id": prompt.generated_image.id,
                                    "image_path": prompt.generated_image.image_path,
                                    "state": prompt.generated_image.state.value
                                } if prompt.generated_image else None
                            }
                            for prompt in sorted(scene.image_prompts, key=lambda x: x.shot_number)
                        ],
                        "video_prompts": [
                            {
                                "id": vp.id,
                                "segment_number": vp.segment_number,
                                "prompt_text": vp.prompt_text,
                                "duration_seconds": vp.duration_seconds,
                                "camera_movement": vp.camera_movement,
                                "state": vp.state.value,
                                "generated_video": {
                                    "id": vp.generated_video.id,
                                    "video_path": vp.generated_video.video_path,
                                    "state": vp.generated_video.state.value
                                } if vp.generated_video else None
                            }
                            for vp in sorted(scene.video_prompts, key=lambda x: x.segment_number)
                        ]
                    }
                    for scene in sorted(episode.scenes, key=lambda x: x.scene_number)
                ]
            }
            for episode in sorted(project.episodes, key=lambda x: x.episode_number)
        ],
        "thumbnails": [
            {
                "id": thumb.id,
                "episode_id": thumb.episode_id,
                "orientation": thumb.orientation,
                "prompt_text": thumb.prompt_text,
                "image_path": thumb.image_path,
                "state": thumb.state.value
            }
            for thumb in project.thumbnails
        ]
    }
    
    # Save to file
    os.makedirs(OUTPUTS_DIR, exist_ok=True)
    filename = f"{project.id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    filepath = os.path.join(OUTPUTS_DIR, filename)
    
    with open(filepath, 'w') as f:
        json.dump(export_data, f, indent=2)
    
    return FileResponse(
        path=filepath,
        filename=filename,
        media_type='application/json'
    )


@router.get("/scripts")
def export_scripts_only(project_id: str, db: Session = Depends(get_db)):
    """Export just the episode scripts as JSON"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    scripts = []
    for episode in sorted(project.episodes, key=lambda x: x.episode_number):
        script = {
            "episode_number": episode.episode_number,
            "title": episode.title,
            "cold_open": episode.cold_open,
            "music_cue": episode.music_cue,
            "scenes": []
        }
        
        for scene in sorted(episode.scenes, key=lambda x: x.scene_number):
            scene_data = {
                "scene_number": scene.scene_number,
                "title": scene.title,
                "location": scene.location.name if scene.location else "Unknown",
                "time_of_day": scene.time_of_day,
                "duration_seconds": scene.duration_seconds,
                "dialogue": []
            }
            
            for line in sorted(scene.dialogue_lines, key=lambda x: x.line_number):
                if line.direction:
                    scene_data["dialogue"].append({
                        "character": line.character_name,
                        "line": line.line_text,
                        "direction": line.direction
                    })
                else:
                    scene_data["dialogue"].append({
                        "character": line.character_name,
                        "line": line.line_text
                    })
            
            script["scenes"].append(scene_data)
        
        script["cliffhanger"] = episode.cliffhanger_moment
        scripts.append(script)
    
    return {
        "project": {
            "title": project.title,
            "setting": project.setting
        },
        "scripts": scripts
    }


@router.get("/prompts")
def export_all_prompts(project_id: str, db: Session = Depends(get_db)):
    """Export all image and video prompts"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    prompts = {
        "character_refs": [
            {
                "character": char.name,
                "prompt": char.reference.prompt_text if char.reference else None
            }
            for char in project.characters
        ],
        "location_refs": [
            {
                "location": loc.name,
                "prompt": loc.reference.prompt_text if loc.reference else None
            }
            for loc in project.locations
        ],
        "image_prompts": [],
        "video_prompts": [],
        "thumbnail_prompts": [
            {
                "episode_id": thumb.episode_id,
                "orientation": thumb.orientation,
                "prompt": thumb.prompt_text
            }
            for thumb in project.thumbnails
        ]
    }
    
    for episode in sorted(project.episodes, key=lambda x: x.episode_number):
        for scene in sorted(episode.scenes, key=lambda x: x.scene_number):
            for img_prompt in sorted(scene.image_prompts, key=lambda x: x.shot_number):
                prompts["image_prompts"].append({
                    "episode": episode.episode_number,
                    "scene": scene.scene_number,
                    "shot": img_prompt.shot_number,
                    "description": img_prompt.description,
                    "prompt": img_prompt.prompt_text,
                    "negative_prompt": img_prompt.negative_prompt
                })
            
            for vid_prompt in sorted(scene.video_prompts, key=lambda x: x.segment_number):
                prompts["video_prompts"].append({
                    "episode": episode.episode_number,
                    "scene": scene.scene_number,
                    "segment": vid_prompt.segment_number,
                    "prompt": vid_prompt.prompt_text,
                    "duration_seconds": vid_prompt.duration_seconds,
                    "camera_movement": vid_prompt.camera_movement
                })
    
    return prompts
