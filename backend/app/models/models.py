"""
SQLAlchemy models for Telenovela Agent v2
15 tables with state machines for object-centric architecture
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List
from sqlalchemy import (
    Column, String, Integer, Float, Text, DateTime, ForeignKey,
    Enum as SQLEnum, JSON, create_engine
)
from sqlalchemy.orm import relationship, declarative_base, Session
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
import uuid

from app.models.mixins import StateMachineMixin

Base = declarative_base()

def generate_uuid():
    return str(uuid.uuid4())


# ============================================================================
# STATE ENUMS
# ============================================================================

class IdeaState(str, Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    REJECTED = "rejected"


class StructureState(str, Enum):
    DRAFT = "draft"
    MODIFIED = "modified"
    APPROVED = "approved"


class GenerationState(str, Enum):
    PENDING = "pending"
    GENERATING = "generating"
    GENERATED = "generated"
    APPROVED = "approved"


class MediaState(str, Enum):
    PENDING = "pending"
    GENERATING = "generating"
    GENERATED = "generated"
    APPROVED = "approved"
    REJECTED = "rejected"


class PromptState(str, Enum):
    PENDING = "pending"
    GENERATED = "generated"
    APPROVED = "approved"


# ============================================================================
# PROJECT
# ============================================================================

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String, nullable=True)
    setting = Column(Text, nullable=True)
    num_episodes = Column(Integer, default=20)
    current_step = Column(Integer, default=1)  # 1-12
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    ideas = relationship("Idea", back_populates="project", cascade="all, delete-orphan")
    characters = relationship("Character", back_populates="project", cascade="all, delete-orphan")
    locations = relationship("Location", back_populates="project", cascade="all, delete-orphan")
    episode_summaries = relationship("EpisodeSummary", back_populates="project", cascade="all, delete-orphan")
    episodes = relationship("Episode", back_populates="project", cascade="all, delete-orphan")
    thumbnails = relationship("Thumbnail", back_populates="project", cascade="all, delete-orphan")
    
    def can_advance_to(self, step: int) -> bool:
        """Check if project can advance to given step"""
        if step <= self.current_step:
            return True
        if step > self.current_step + 1:
            return False
        # Check prerequisites for each step
        step_checks = {
            2: self._check_step_2,  # Need approved idea
            3: self._check_step_2,  # Same - idea approved
            4: self._check_step_4,  # Need structure generated
            5: self._check_step_5,  # Need structure approved
            6: self._check_step_6,  # Need episodes generated
            7: self._check_step_6,  # Same
            8: self._check_step_8,  # Need image prompts + refs
            9: self._check_step_8,  # Same
            10: self._check_step_10, # Need images generated
            11: self._check_step_11, # Need images approved
            12: self._check_step_12, # Need video prompts approved
        }
        check_fn = step_checks.get(step)
        return check_fn() if check_fn else True
    
    def _check_step_2(self) -> bool:
        return any(i.state == IdeaState.APPROVED for i in self.ideas)
    
    def _check_step_4(self) -> bool:
        return len(self.characters) > 0 and len(self.locations) > 0 and len(self.episode_summaries) > 0
    
    def _check_step_5(self) -> bool:
        return (
            all(c.state == StructureState.APPROVED for c in self.characters) and
            all(l.state == StructureState.APPROVED for l in self.locations) and
            all(e.state == StructureState.APPROVED for e in self.episode_summaries)
        )
    
    def _check_step_6(self) -> bool:
        return any(e.state == GenerationState.GENERATED for e in self.episodes)
    
    def _check_step_8(self) -> bool:
        has_prompts = any(
            p.state in [PromptState.GENERATED, PromptState.APPROVED]
            for e in self.episodes
            for s in e.scenes
            for p in s.image_prompts
        )
        has_char_refs = all(c.reference and c.reference.state != MediaState.PENDING for c in self.characters)
        has_loc_refs = all(l.reference and l.reference.state != MediaState.PENDING for l in self.locations)
        return has_prompts and has_char_refs and has_loc_refs
    
    def _check_step_10(self) -> bool:
        return any(
            p.generated_image and p.generated_image.state == MediaState.GENERATED
            for e in self.episodes
            for s in e.scenes
            for p in s.image_prompts
        )
    
    def _check_step_11(self) -> bool:
        # All images must be reviewed (approved or rejected), at least one approved
        images = [
            p.generated_image
            for e in self.episodes
            for s in e.scenes
            for p in s.image_prompts
            if p.generated_image
        ]
        if not images:
            return False
        all_reviewed = all(
            img.state in (MediaState.APPROVED, MediaState.REJECTED)
            for img in images
        )
        has_approved = any(img.state == MediaState.APPROVED for img in images)
        return all_reviewed and has_approved
    
    def _check_step_12(self) -> bool:
        return any(
            vp.state == PromptState.APPROVED
            for e in self.episodes
            for s in e.scenes
            for vp in s.video_prompts
        )


# ============================================================================
# IDEA (Step 1-2)
# ============================================================================

class Idea(StateMachineMixin, Base):
    __tablename__ = "ideas"

    VALID_TRANSITIONS = {
        IdeaState.DRAFT: {IdeaState.APPROVED, IdeaState.REJECTED},
        IdeaState.APPROVED: set(),
        IdeaState.REJECTED: set(),
    }

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    setting = Column(Text)
    logline = Column(Text)
    hook = Column(Text)
    main_conflict = Column(Text)
    state = Column(SQLEnum(IdeaState), default=IdeaState.DRAFT)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="ideas")

    def approve(self):
        self.transition_to(IdeaState.APPROVED)
        self.project.title = self.title
        self.project.setting = self.setting
        return True

    def reject(self):
        self.transition_to(IdeaState.REJECTED)
        return True


# ============================================================================
# STRUCTURE (Step 3-4): Characters, Locations, Episode Summaries
# ============================================================================

class Character(StateMachineMixin, Base):
    __tablename__ = "characters"

    VALID_TRANSITIONS = {
        StructureState.DRAFT: {StructureState.MODIFIED, StructureState.APPROVED},
        StructureState.MODIFIED: {StructureState.APPROVED},
        StructureState.APPROVED: {StructureState.MODIFIED},
    }

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    role = Column(String)  # protagonist, antagonist, love_interest, etc.
    archetype = Column(String)
    age = Column(String)
    physical_description = Column(Text)
    personality = Column(Text)
    motivation = Column(Text)
    secret = Column(Text)
    arc = Column(Text)
    state = Column(SQLEnum(StructureState), default=StructureState.DRAFT)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="characters")
    reference = relationship("CharacterRef", back_populates="character", uselist=False, cascade="all, delete-orphan")
    dialogue_lines = relationship("DialogueLine", back_populates="character")

    def approve(self):
        self.transition_to(StructureState.APPROVED)

    def modify(self):
        if self.state != StructureState.APPROVED:
            self.transition_to(StructureState.MODIFIED)

    def unapprove(self):
        self.transition_to(StructureState.MODIFIED)


class Location(StateMachineMixin, Base):
    __tablename__ = "locations"

    VALID_TRANSITIONS = {
        StructureState.DRAFT: {StructureState.MODIFIED, StructureState.APPROVED},
        StructureState.MODIFIED: {StructureState.APPROVED},
        StructureState.APPROVED: {StructureState.MODIFIED},
    }

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String)  # interior, exterior
    description = Column(Text)
    mood = Column(String)
    significance = Column(Text)
    visual_details = Column(Text)
    state = Column(SQLEnum(StructureState), default=StructureState.DRAFT)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="locations")
    reference = relationship("LocationRef", back_populates="location", uselist=False, cascade="all, delete-orphan")
    scenes = relationship("Scene", back_populates="location")

    def approve(self):
        self.transition_to(StructureState.APPROVED)

    def modify(self):
        if self.state != StructureState.APPROVED:
            self.transition_to(StructureState.MODIFIED)

    def unapprove(self):
        self.transition_to(StructureState.MODIFIED)


class EpisodeSummary(StateMachineMixin, Base):
    __tablename__ = "episode_summaries"

    VALID_TRANSITIONS = {
        StructureState.DRAFT: {StructureState.MODIFIED, StructureState.APPROVED},
        StructureState.MODIFIED: {StructureState.APPROVED},
        StructureState.APPROVED: {StructureState.MODIFIED},
    }

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    episode_number = Column(Integer, nullable=False)
    title = Column(String)
    summary = Column(Text)
    key_beats = Column(JSON)  # List of plot beats
    cliffhanger = Column(Text)
    emotional_arc = Column(String)
    state = Column(SQLEnum(StructureState), default=StructureState.DRAFT)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="episode_summaries")

    def approve(self):
        self.transition_to(StructureState.APPROVED)

    def modify(self):
        if self.state != StructureState.APPROVED:
            self.transition_to(StructureState.MODIFIED)

    def unapprove(self):
        self.transition_to(StructureState.MODIFIED)


# ============================================================================
# EPISODES & SCENES (Step 5)
# ============================================================================

class Episode(StateMachineMixin, Base):
    __tablename__ = "episodes"

    VALID_TRANSITIONS = {
        GenerationState.PENDING: {GenerationState.GENERATING},
        GenerationState.GENERATING: {GenerationState.GENERATED, GenerationState.PENDING},
        GenerationState.GENERATED: {GenerationState.APPROVED},
        GenerationState.APPROVED: {GenerationState.GENERATED},
    }

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    episode_number = Column(Integer, nullable=False)
    title = Column(String)
    cold_open = Column(Text)
    music_cue = Column(String)
    cliffhanger_moment = Column(Text)
    state = Column(SQLEnum(GenerationState), default=GenerationState.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="episodes")
    scenes = relationship("Scene", back_populates="episode", cascade="all, delete-orphan", order_by="Scene.scene_number")
    thumbnails = relationship("Thumbnail", back_populates="episode", cascade="all, delete-orphan")

    def mark_generating(self):
        self.transition_to(GenerationState.GENERATING)

    def mark_generated(self):
        self.transition_to(GenerationState.GENERATED)

    def approve(self):
        self.transition_to(GenerationState.APPROVED)

    def unapprove(self):
        self.transition_to(GenerationState.GENERATED)


class Scene(Base):
    __tablename__ = "scenes"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    episode_id = Column(String, ForeignKey("episodes.id"), nullable=False)
    location_id = Column(String, ForeignKey("locations.id"), nullable=True)
    scene_number = Column(Integer, nullable=False)
    title = Column(String)
    duration_seconds = Column(Integer, default=60)
    time_of_day = Column(String)
    mood = Column(String)
    action_beats = Column(JSON)  # List of action descriptions
    camera_notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    episode = relationship("Episode", back_populates="scenes")
    location = relationship("Location", back_populates="scenes")
    dialogue_lines = relationship("DialogueLine", back_populates="scene", cascade="all, delete-orphan", order_by="DialogueLine.line_number")
    image_prompts = relationship("ImagePrompt", back_populates="scene", cascade="all, delete-orphan", order_by="ImagePrompt.shot_number")
    video_prompts = relationship("VideoPrompt", back_populates="scene", cascade="all, delete-orphan")


class DialogueLine(Base):
    __tablename__ = "dialogue_lines"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    scene_id = Column(String, ForeignKey("scenes.id"), nullable=False)
    character_id = Column(String, ForeignKey("characters.id"), nullable=True)
    line_number = Column(Integer, nullable=False)
    character_name = Column(String)  # Denormalized for convenience
    line_text = Column(Text, nullable=False)
    direction = Column(String)  # Parenthetical direction
    emotion = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    scene = relationship("Scene", back_populates="dialogue_lines")
    character = relationship("Character", back_populates="dialogue_lines")


# ============================================================================
# IMAGE PROMPTS (Step 6)
# ============================================================================

class ImagePrompt(StateMachineMixin, Base):
    __tablename__ = "image_prompts"

    VALID_TRANSITIONS = {
        PromptState.PENDING: {PromptState.GENERATED},
        PromptState.GENERATED: {PromptState.APPROVED},
        PromptState.APPROVED: {PromptState.GENERATED},
    }

    id = Column(String, primary_key=True, default=generate_uuid)
    scene_id = Column(String, ForeignKey("scenes.id"), nullable=False)
    shot_number = Column(Integer, nullable=False)
    shot_type = Column(String)  # wide, medium, close-up, etc.
    description = Column(Text)  # What's happening in the shot
    prompt_text = Column(Text)  # Full prompt for image generation
    negative_prompt = Column(Text)
    state = Column(SQLEnum(PromptState), default=PromptState.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)

    scene = relationship("Scene", back_populates="image_prompts")
    generated_image = relationship("GeneratedImage", back_populates="image_prompt", uselist=False, cascade="all, delete-orphan")

    def mark_generated(self):
        self.transition_to(PromptState.GENERATED)

    def approve(self):
        self.transition_to(PromptState.APPROVED)


# ============================================================================
# REFERENCE IMAGES (Step 7)
# ============================================================================

class CharacterRef(StateMachineMixin, Base):
    __tablename__ = "character_refs"

    VALID_TRANSITIONS = {
        MediaState.PENDING: {MediaState.GENERATING},
        MediaState.GENERATING: {MediaState.GENERATED, MediaState.PENDING},
        MediaState.GENERATED: {MediaState.APPROVED, MediaState.REJECTED},
        MediaState.APPROVED: {MediaState.REJECTED},
        MediaState.REJECTED: {MediaState.PENDING},
    }

    id = Column(String, primary_key=True, default=generate_uuid)
    character_id = Column(String, ForeignKey("characters.id"), nullable=False)
    prompt_text = Column(Text)
    image_path = Column(String)  # Local file path
    image_url = Column(String)   # Or remote URL
    state = Column(SQLEnum(MediaState), default=MediaState.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)

    character = relationship("Character", back_populates="reference")

    def mark_generating(self):
        self.transition_to(MediaState.GENERATING)

    def mark_generated(self, path: str):
        self.image_path = path
        self.transition_to(MediaState.GENERATED)

    def approve(self):
        self.transition_to(MediaState.APPROVED)

    def reject(self):
        self.transition_to(MediaState.REJECTED)

    def reset_for_regen(self):
        self.transition_to(MediaState.PENDING)
        self.image_path = None


class LocationRef(StateMachineMixin, Base):
    __tablename__ = "location_refs"

    VALID_TRANSITIONS = {
        MediaState.PENDING: {MediaState.GENERATING},
        MediaState.GENERATING: {MediaState.GENERATED, MediaState.PENDING},
        MediaState.GENERATED: {MediaState.APPROVED, MediaState.REJECTED},
        MediaState.APPROVED: {MediaState.REJECTED},
        MediaState.REJECTED: {MediaState.PENDING},
    }

    id = Column(String, primary_key=True, default=generate_uuid)
    location_id = Column(String, ForeignKey("locations.id"), nullable=False)
    prompt_text = Column(Text)
    image_path = Column(String)
    image_url = Column(String)
    state = Column(SQLEnum(MediaState), default=MediaState.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)

    location = relationship("Location", back_populates="reference")

    def mark_generating(self):
        self.transition_to(MediaState.GENERATING)

    def mark_generated(self, path: str):
        self.image_path = path
        self.transition_to(MediaState.GENERATED)

    def approve(self):
        self.transition_to(MediaState.APPROVED)

    def reject(self):
        self.transition_to(MediaState.REJECTED)

    def reset_for_regen(self):
        self.transition_to(MediaState.PENDING)
        self.image_path = None


# ============================================================================
# GENERATED IMAGES (Step 8)
# ============================================================================

class GeneratedImage(StateMachineMixin, Base):
    __tablename__ = "generated_images"

    VALID_TRANSITIONS = {
        MediaState.PENDING: {MediaState.GENERATING},
        MediaState.GENERATING: {MediaState.GENERATED, MediaState.PENDING},
        MediaState.GENERATED: {MediaState.APPROVED, MediaState.REJECTED},
        MediaState.APPROVED: {MediaState.REJECTED},
        MediaState.REJECTED: {MediaState.PENDING},
    }

    id = Column(String, primary_key=True, default=generate_uuid)
    image_prompt_id = Column(String, ForeignKey("image_prompts.id"), nullable=False)
    image_path = Column(String)
    image_url = Column(String)
    state = Column(SQLEnum(MediaState), default=MediaState.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)

    image_prompt = relationship("ImagePrompt", back_populates="generated_image")

    def mark_generating(self):
        self.transition_to(MediaState.GENERATING)

    def mark_generated(self, path: str):
        self.image_path = path
        self.transition_to(MediaState.GENERATED)

    def approve(self):
        self.transition_to(MediaState.APPROVED)

    def reject(self):
        self.transition_to(MediaState.REJECTED)

    def reset_for_regen(self):
        self.transition_to(MediaState.PENDING)
        self.image_path = None


# ============================================================================
# THUMBNAILS (Step 9)
# ============================================================================

class Thumbnail(StateMachineMixin, Base):
    __tablename__ = "thumbnails"

    VALID_TRANSITIONS = {
        MediaState.PENDING: {MediaState.GENERATING},
        MediaState.GENERATING: {MediaState.GENERATED, MediaState.PENDING},
        MediaState.GENERATED: {MediaState.APPROVED, MediaState.REJECTED},
        MediaState.APPROVED: {MediaState.REJECTED},
        MediaState.REJECTED: {MediaState.PENDING},
    }

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    episode_id = Column(String, ForeignKey("episodes.id"), nullable=True)
    orientation = Column(String)  # "vertical" or "horizontal"
    prompt_text = Column(Text)
    image_path = Column(String)
    image_url = Column(String)
    state = Column(SQLEnum(MediaState), default=MediaState.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="thumbnails")
    episode = relationship("Episode", back_populates="thumbnails")

    def mark_generating(self):
        self.transition_to(MediaState.GENERATING)

    def mark_generated(self, path: str):
        self.image_path = path
        self.transition_to(MediaState.GENERATED)

    def approve(self):
        self.transition_to(MediaState.APPROVED)

    def reject(self):
        self.transition_to(MediaState.REJECTED)

    def reset_for_regen(self):
        self.transition_to(MediaState.PENDING)
        self.image_path = None


# ============================================================================
# VIDEO PROMPTS (Step 11)
# ============================================================================

class VideoPrompt(StateMachineMixin, Base):
    __tablename__ = "video_prompts"

    VALID_TRANSITIONS = {
        PromptState.PENDING: {PromptState.GENERATED},
        PromptState.GENERATED: {PromptState.APPROVED},
        PromptState.APPROVED: {PromptState.GENERATED},
    }

    id = Column(String, primary_key=True, default=generate_uuid)
    scene_id = Column(String, ForeignKey("scenes.id"), nullable=False)
    segment_number = Column(Integer, default=1)
    prompt_text = Column(Text)
    duration_seconds = Column(Integer, default=5)
    camera_movement = Column(String)
    reference_image_id = Column(String)  # ID of GeneratedImage to use as reference
    state = Column(SQLEnum(PromptState), default=PromptState.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)

    scene = relationship("Scene", back_populates="video_prompts")
    generated_video = relationship("GeneratedVideo", back_populates="video_prompt", uselist=False, cascade="all, delete-orphan")

    def mark_generated(self):
        self.transition_to(PromptState.GENERATED)

    def approve(self):
        self.transition_to(PromptState.APPROVED)


# ============================================================================
# GENERATED VIDEOS (Step 12)
# ============================================================================

class GeneratedVideo(StateMachineMixin, Base):
    __tablename__ = "generated_videos"

    VALID_TRANSITIONS = {
        MediaState.PENDING: {MediaState.GENERATING},
        MediaState.GENERATING: {MediaState.GENERATED, MediaState.PENDING},
        MediaState.GENERATED: {MediaState.APPROVED, MediaState.REJECTED},
        MediaState.APPROVED: {MediaState.REJECTED},
        MediaState.REJECTED: {MediaState.PENDING},
    }

    id = Column(String, primary_key=True, default=generate_uuid)
    video_prompt_id = Column(String, ForeignKey("video_prompts.id"), nullable=False)
    video_path = Column(String)
    video_url = Column(String)
    duration_seconds = Column(Float)
    state = Column(SQLEnum(MediaState), default=MediaState.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)

    video_prompt = relationship("VideoPrompt", back_populates="generated_video")

    def mark_generating(self):
        self.transition_to(MediaState.GENERATING)

    def mark_generated(self, path: str, duration: float = None):
        self.video_path = path
        if duration:
            self.duration_seconds = duration
        self.transition_to(MediaState.GENERATED)

    def approve(self):
        self.transition_to(MediaState.APPROVED)

    def reject(self):
        self.transition_to(MediaState.REJECTED)

    def reset_for_regen(self):
        self.transition_to(MediaState.PENDING)
        self.video_path = None


# ============================================================================
# APP SETTINGS (key-value store for config like API keys)
# ============================================================================

class AppSetting(Base):
    """Persistent key-value settings store"""
    __tablename__ = "app_settings"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================================================
# DATABASE INITIALIZATION
# ============================================================================

def init_db(database_url: str = "sqlite:///telenovela.db"):
    """Initialize database and create all tables"""
    engine = create_engine(database_url, echo=False)
    Base.metadata.create_all(engine)
    return engine
