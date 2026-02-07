"""
Structure API routes (Step 3-4): Characters, Locations, Episode Summaries
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database.session import get_db
from app.models.models import (
    Project, Idea, Character, Location, EpisodeSummary,
    IdeaState, StructureState
)
from app.models.schemas import (
    CharacterResponse, CharacterUpdate,
    LocationResponse, LocationUpdate,
    EpisodeSummaryResponse, EpisodeSummaryUpdate
)
from app.services.generator import generator

router = APIRouter(prefix="/projects/{project_id}", tags=["structure"])


# ============================================================================
# GENERATE ALL STRUCTURE (Step 3)
# ============================================================================

@router.post("/structure/generate")
async def generate_structure(project_id: str, db: Session = Depends(get_db)):
    """Generate characters, locations, and episode arc (Step 3)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get approved idea
    approved_idea = next((i for i in project.ideas if i.state == IdeaState.APPROVED), None)
    if not approved_idea:
        raise HTTPException(status_code=400, detail="No approved idea - select an idea first")
    
    # Clear existing structure
    for c in project.characters:
        db.delete(c)
    for l in project.locations:
        db.delete(l)
    for e in project.episode_summaries:
        db.delete(e)
    db.flush()
    
    # Generate characters
    characters_data = await generator.generate_characters(
        title=approved_idea.title,
        setting=approved_idea.setting,
        logline=approved_idea.logline,
        main_conflict=approved_idea.main_conflict,
        num_episodes=project.num_episodes
    )
    
    characters = []
    for char_data in characters_data:
        char = Character(
            project_id=project_id,
            name=char_data.get("name", "Unknown"),
            role=char_data.get("role", "supporting"),
            archetype=char_data.get("archetype", ""),
            age=char_data.get("age", ""),
            physical_description=char_data.get("physical_description", ""),
            personality=char_data.get("personality", ""),
            motivation=char_data.get("motivation", ""),
            secret=char_data.get("secret", ""),
            arc=char_data.get("arc", ""),
            state=StructureState.DRAFT
        )
        db.add(char)
        characters.append(char)
    
    # Generate locations
    locations_data = await generator.generate_locations(
        title=approved_idea.title,
        setting=approved_idea.setting,
        characters=characters_data
    )
    
    locations = []
    for loc_data in locations_data:
        loc = Location(
            project_id=project_id,
            name=loc_data.get("name", "Unknown"),
            type=loc_data.get("type", "interior"),
            description=loc_data.get("description", ""),
            mood=loc_data.get("mood", ""),
            significance=loc_data.get("significance", ""),
            visual_details=loc_data.get("visual_details", ""),
            state=StructureState.DRAFT
        )
        db.add(loc)
        locations.append(loc)
    
    # Generate episode arc
    episode_arc_data = await generator.generate_episode_arc(
        title=approved_idea.title,
        setting=approved_idea.setting,
        logline=approved_idea.logline,
        main_conflict=approved_idea.main_conflict,
        characters=characters_data,
        locations=locations_data,
        num_episodes=project.num_episodes
    )
    
    episode_summaries = []
    for ep_data in episode_arc_data:
        ep_summary = EpisodeSummary(
            project_id=project_id,
            episode_number=ep_data.get("episode_number", 1),
            title=ep_data.get("title", "Untitled"),
            summary=ep_data.get("summary", ""),
            key_beats=ep_data.get("key_beats", []),
            cliffhanger=ep_data.get("cliffhanger", ""),
            emotional_arc=ep_data.get("emotional_arc", ""),
            state=StructureState.DRAFT
        )
        db.add(ep_summary)
        episode_summaries.append(ep_summary)
    
    # Advance to step 3
    if project.current_step < 3:
        project.current_step = 3
    
    db.commit()
    
    return {
        "status": "generated",
        "characters_count": len(characters),
        "locations_count": len(locations),
        "episode_summaries_count": len(episode_summaries)
    }


# ============================================================================
# CHARACTERS
# ============================================================================

@router.get("/characters", response_model=List[CharacterResponse])
def list_characters(project_id: str, db: Session = Depends(get_db)):
    """List all characters"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project.characters


# Character-level routes
character_router = APIRouter(prefix="/characters", tags=["structure"])


@character_router.get("/{character_id}", response_model=CharacterResponse)
def get_character(character_id: str, db: Session = Depends(get_db)):
    """Get a character"""
    char = db.query(Character).filter(Character.id == character_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    return char


@character_router.put("/{character_id}", response_model=CharacterResponse)
def update_character(character_id: str, data: CharacterUpdate, db: Session = Depends(get_db)):
    """Update a character"""
    char = db.query(Character).filter(Character.id == character_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(char, field, value)
    
    char.modify()  # Mark as modified
    db.commit()
    db.refresh(char)
    return char


@character_router.post("/{character_id}/approve")
def approve_character(character_id: str, db: Session = Depends(get_db)):
    """Approve a character"""
    char = db.query(Character).filter(Character.id == character_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    
    char.approve()
    db.commit()
    return {"status": "approved", "character_id": character_id}


# ============================================================================
# LOCATIONS
# ============================================================================

@router.get("/locations", response_model=List[LocationResponse])
def list_locations(project_id: str, db: Session = Depends(get_db)):
    """List all locations"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project.locations


# Location-level routes
location_router = APIRouter(prefix="/locations", tags=["structure"])


@location_router.get("/{location_id}", response_model=LocationResponse)
def get_location(location_id: str, db: Session = Depends(get_db)):
    """Get a location"""
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    return loc


@location_router.put("/{location_id}", response_model=LocationResponse)
def update_location(location_id: str, data: LocationUpdate, db: Session = Depends(get_db)):
    """Update a location"""
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(loc, field, value)
    
    loc.modify()
    db.commit()
    db.refresh(loc)
    return loc


@location_router.post("/{location_id}/approve")
def approve_location(location_id: str, db: Session = Depends(get_db)):
    """Approve a location"""
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    
    loc.approve()
    db.commit()
    return {"status": "approved", "location_id": location_id}


# ============================================================================
# EPISODE SUMMARIES
# ============================================================================

@router.get("/episode-summaries", response_model=List[EpisodeSummaryResponse])
def list_episode_summaries(project_id: str, db: Session = Depends(get_db)):
    """List all episode summaries"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return sorted(project.episode_summaries, key=lambda x: x.episode_number)


# Episode summary-level routes
episode_summary_router = APIRouter(prefix="/episode-summaries", tags=["structure"])


@episode_summary_router.get("/{summary_id}", response_model=EpisodeSummaryResponse)
def get_episode_summary(summary_id: str, db: Session = Depends(get_db)):
    """Get an episode summary"""
    ep = db.query(EpisodeSummary).filter(EpisodeSummary.id == summary_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Episode summary not found")
    return ep


@episode_summary_router.put("/{summary_id}", response_model=EpisodeSummaryResponse)
def update_episode_summary(summary_id: str, data: EpisodeSummaryUpdate, db: Session = Depends(get_db)):
    """Update an episode summary"""
    ep = db.query(EpisodeSummary).filter(EpisodeSummary.id == summary_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Episode summary not found")
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(ep, field, value)
    
    ep.modify()
    db.commit()
    db.refresh(ep)
    return ep


@episode_summary_router.post("/{summary_id}/approve")
def approve_episode_summary(summary_id: str, db: Session = Depends(get_db)):
    """Approve an episode summary"""
    ep = db.query(EpisodeSummary).filter(EpisodeSummary.id == summary_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Episode summary not found")
    
    ep.approve()
    db.commit()
    return {"status": "approved", "summary_id": summary_id}


# ============================================================================
# APPROVE ALL STRUCTURE (Step 4)
# ============================================================================

@router.post("/structure/approve-all")
def approve_all_structure(project_id: str, db: Session = Depends(get_db)):
    """Approve all characters, locations, and episode summaries at once"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    for char in project.characters:
        char.approve()
    for loc in project.locations:
        loc.approve()
    for ep in project.episode_summaries:
        ep.approve()
    
    # Advance to step 4 (structure approved)
    if project.current_step < 4:
        project.current_step = 4
    
    db.commit()
    
    return {
        "status": "all_approved",
        "characters_approved": len(project.characters),
        "locations_approved": len(project.locations),
        "episode_summaries_approved": len(project.episode_summaries)
    }
