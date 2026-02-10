"""
Project API routes
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database.session import get_db
from app.models.models import (
    Project, Idea, Character, Location, EpisodeSummary, Episode,
    ImagePrompt, GeneratedImage, MediaState
)
from app.models.schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectDetail, StepProgress, STEP_NAMES
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectResponse)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    """Create a new project"""
    project = Project(
        title=data.title,
        setting=data.setting,
        num_episodes=data.num_episodes,
        current_step=1
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_to_response(project)


@router.get("", response_model=List[ProjectResponse])
def list_projects(db: Session = Depends(get_db)):
    """List all projects"""
    projects = db.query(Project).order_by(Project.updated_at.desc()).all()
    return [_project_to_response(p) for p in projects]


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(project_id: str, db: Session = Depends(get_db)):
    """Get project with all details"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _project_to_detail(project)


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: str, data: ProjectUpdate, db: Session = Depends(get_db)):
    """Update project settings (e.g. num_episodes)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if data.num_episodes is not None:
        project.num_episodes = data.num_episodes

    db.commit()
    db.refresh(project)
    return _project_to_response(project)


@router.delete("/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    """Delete a project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return {"status": "deleted"}


@router.get("/{project_id}/progress", response_model=StepProgress)
def get_step_progress(project_id: str, db: Session = Depends(get_db)):
    """Get current step progress"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    step = project.current_step
    can_proceed = project.can_advance_to(step + 1)
    
    # Calculate progress based on current step
    items_total, items_completed, items_pending, blocking_reason = _get_step_stats(project, step)
    
    return StepProgress(
        current_step=step,
        step_name=STEP_NAMES.get(step, "Unknown"),
        can_proceed=can_proceed,
        blocking_reason=blocking_reason if not can_proceed else None,
        items_total=items_total,
        items_completed=items_completed,
        items_pending=items_pending
    )


@router.post("/{project_id}/advance-step")
def advance_step(project_id: str, db: Session = Depends(get_db)):
    """Advance to next step if allowed"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    next_step = project.current_step + 1
    if next_step > 12:
        raise HTTPException(status_code=400, detail="Already at final step")
    
    if not project.can_advance_to(next_step):
        raise HTTPException(status_code=400, detail=f"Cannot advance to step {next_step} - prerequisites not met")
    
    project.current_step = next_step
    db.commit()
    
    return {
        "current_step": project.current_step,
        "step_name": STEP_NAMES.get(project.current_step, "Unknown")
    }


def _project_to_response(project: Project) -> ProjectResponse:
    """Convert Project model to response schema"""
    # Count images pending review
    images_pending = 0
    for episode in project.episodes:
        for scene in episode.scenes:
            for img_prompt in scene.image_prompts:
                if img_prompt.generated_image and img_prompt.generated_image.state == MediaState.GENERATED:
                    images_pending += 1
    
    return ProjectResponse(
        id=project.id,
        title=project.title,
        setting=project.setting,
        num_episodes=project.num_episodes,
        current_step=project.current_step,
        created_at=project.created_at,
        updated_at=project.updated_at,
        ideas_count=len(project.ideas),
        characters_count=len(project.characters),
        locations_count=len(project.locations),
        episodes_generated=len([e for e in project.episodes if e.state.value != "pending"]),
        images_pending_review=images_pending,
        videos_generated=0  # TODO: count videos
    )


def _project_to_detail(project: Project) -> ProjectDetail:
    """Convert Project model to detailed response"""
    base = _project_to_response(project)
    return ProjectDetail(
        **base.model_dump(),
        ideas=[],  # Will be populated by Pydantic from relationship
        characters=[],
        locations=[],
        episode_summaries=[]
    )


def _get_step_stats(project: Project, step: int) -> tuple:
    """Get statistics for current step"""
    items_total = 0
    items_completed = 0
    items_pending = 0
    blocking_reason = None
    
    if step == 1:  # Generate Ideas
        items_total = 3
        items_completed = len(project.ideas)
        items_pending = 3 - items_completed
        if items_pending > 0:
            blocking_reason = "Generate ideas first"
    
    elif step == 2:  # Select Idea
        items_total = len(project.ideas)
        items_completed = len([i for i in project.ideas if i.state.value == "approved"])
        if items_completed == 0:
            blocking_reason = "Select an idea to continue"
    
    elif step == 3:  # Generate Structure
        items_total = 3  # characters, locations, episode_summaries
        if len(project.characters) > 0:
            items_completed += 1
        if len(project.locations) > 0:
            items_completed += 1
        if len(project.episode_summaries) > 0:
            items_completed += 1
        items_pending = items_total - items_completed
        if items_pending > 0:
            blocking_reason = "Generate structure (characters, locations, episode arc)"
    
    elif step == 4:  # Approve Structure
        chars_approved = all(c.state.value == "approved" for c in project.characters)
        locs_approved = all(l.state.value == "approved" for l in project.locations)
        eps_approved = all(e.state.value == "approved" for e in project.episode_summaries)
        
        items_total = len(project.characters) + len(project.locations) + len(project.episode_summaries)
        items_completed = (
            len([c for c in project.characters if c.state.value == "approved"]) +
            len([l for l in project.locations if l.state.value == "approved"]) +
            len([e for e in project.episode_summaries if e.state.value == "approved"])
        )
        items_pending = items_total - items_completed
        
        if not (chars_approved and locs_approved and eps_approved):
            blocking_reason = "Approve all characters, locations, and episode summaries"
    
    elif step == 5:  # Generate Episodes
        items_total = project.num_episodes
        items_completed = len([e for e in project.episodes if e.state.value in ["generated", "approved"]])
        items_pending = items_total - items_completed
        if items_pending > 0:
            blocking_reason = f"Generate remaining {items_pending} episodes"
    
    elif step == 10:  # Review Images
        all_images = []
        for episode in project.episodes:
            for scene in episode.scenes:
                for img_prompt in scene.image_prompts:
                    if img_prompt.generated_image:
                        all_images.append(img_prompt.generated_image)
        
        items_total = len(all_images)
        items_completed = len([i for i in all_images if i.state.value == "approved"])
        items_pending = len([i for i in all_images if i.state.value == "generated"])
        
        if items_pending > 0:
            blocking_reason = f"Review {items_pending} pending images"
    
    return items_total, items_completed, items_pending, blocking_reason
