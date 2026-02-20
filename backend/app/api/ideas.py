"""
Ideas API routes (Step 1-2)
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database.session import get_db
from app.models.models import Project, Idea, IdeaState
from app.models.schemas import IdeaResponse, GenerateIdeasRequest, CustomOutlineRequest
from app.services.generator import generator
from app.api import parse_state_filter
from app.middleware.rate_limit import limiter, AI_GENERATION_LIMIT

router = APIRouter(prefix="/projects/{project_id}/ideas", tags=["ideas"])


@router.get("", response_model=List[IdeaResponse])
def list_ideas(project_id: str, state: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """List all ideas for a project. Optional ?state= filter (comma-separated)."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    states = parse_state_filter(state)
    if states:
        return [i for i in project.ideas if i.state.value in states]
    return project.ideas


@router.post("/generate", response_model=List[IdeaResponse])
@limiter.limit(AI_GENERATION_LIMIT)
async def generate_ideas(
    request: Request,
    project_id: str,
    body: GenerateIdeasRequest = None,
    db: Session = Depends(get_db)
):
    """Generate 3 new ideas for a project (Step 1)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Clear existing ideas if regenerating
    for idea in project.ideas:
        db.delete(idea)
    
    # Generate new ideas
    setting_hint = body.setting_hint if body else None
    ideas_data = await generator.generate_ideas(setting_hint)
    
    ideas = []
    for idea_data in ideas_data:
        idea = Idea(
            project_id=project_id,
            title=idea_data.get("title", "Untitled"),
            setting=idea_data.get("setting", ""),
            logline=idea_data.get("logline", ""),
            hook=idea_data.get("hook", ""),
            main_conflict=idea_data.get("main_conflict", ""),
            state=IdeaState.DRAFT
        )
        db.add(idea)
        ideas.append(idea)
    
    db.commit()
    for idea in ideas:
        db.refresh(idea)
    
    return ideas


@router.post("/custom", response_model=IdeaResponse)
async def add_custom_idea(
    project_id: str,
    request: CustomOutlineRequest,
    db: Session = Depends(get_db)
):
    """Add a custom idea (user-provided outline)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    idea = Idea(
        project_id=project_id,
        title=request.title,
        setting=request.setting,
        logline=request.logline,
        hook=request.hook,
        main_conflict=request.main_conflict,
        state=IdeaState.DRAFT
    )
    db.add(idea)
    db.commit()
    db.refresh(idea)
    
    return idea


# Separate router for idea-level operations
idea_router = APIRouter(prefix="/ideas", tags=["ideas"])


@idea_router.post("/{idea_id}/approve")
def approve_idea(idea_id: str, db: Session = Depends(get_db)):
    """Approve/select an idea (Step 2)"""
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    # Reject all other ideas for this project
    for other in idea.project.ideas:
        if other.id != idea_id and other.state == IdeaState.DRAFT:
            other.state = IdeaState.REJECTED
    
    # Approve this idea
    idea.approve()
    
    # Update project with idea details
    idea.project.title = idea.title
    idea.project.setting = idea.setting
    
    # Advance project to step 2 (idea selected)
    if idea.project.current_step < 2:
        idea.project.current_step = 2
    
    db.commit()
    
    return {"status": "approved", "idea_id": idea_id}


@idea_router.post("/{idea_id}/reject")
def reject_idea(idea_id: str, db: Session = Depends(get_db)):
    """Reject an idea"""
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    idea.reject()
    db.commit()
    
    return {"status": "rejected", "idea_id": idea_id}
