"""
Pydantic schemas for API request/response validation
"""

from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field, field_validator
from enum import Enum


# ============================================================================
# ENUMS (mirror SQLAlchemy enums)
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
# PROJECT SCHEMAS
# ============================================================================

class ProjectCreate(BaseModel):
    title: Optional[str] = None
    setting: Optional[str] = None
    num_episodes: int = 20


class ProjectUpdate(BaseModel):
    num_episodes: Optional[int] = None

    @field_validator('num_episodes')
    @classmethod
    def validate_num_episodes(cls, v):
        if v is not None and (v < 5 or v > 25):
            raise ValueError('num_episodes must be between 5 and 25')
        return v


class ProjectResponse(BaseModel):
    id: str
    title: Optional[str]
    setting: Optional[str]
    num_episodes: int
    current_step: int
    created_at: datetime
    updated_at: datetime
    
    # Counts for dashboard
    ideas_count: int = 0
    characters_count: int = 0
    locations_count: int = 0
    episodes_generated: int = 0
    images_pending_review: int = 0
    videos_generated: int = 0

    class Config:
        from_attributes = True


class ProjectDetail(ProjectResponse):
    """Full project with nested objects"""
    ideas: List["IdeaResponse"] = []
    characters: List["CharacterResponse"] = []
    locations: List["LocationResponse"] = []
    episode_summaries: List["EpisodeSummaryResponse"] = []


# ============================================================================
# IDEA SCHEMAS
# ============================================================================

class IdeaResponse(BaseModel):
    id: str
    project_id: str
    title: str
    setting: Optional[str]
    logline: Optional[str]
    hook: Optional[str]
    main_conflict: Optional[str]
    state: IdeaState
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# STRUCTURE SCHEMAS
# ============================================================================

class CharacterResponse(BaseModel):
    id: str
    project_id: str
    name: str
    role: Optional[str]
    archetype: Optional[str]
    age: Optional[str]
    physical_description: Optional[str]
    personality: Optional[str]
    motivation: Optional[str]
    secret: Optional[str]
    arc: Optional[str]
    state: StructureState
    reference: Optional["CharacterRefResponse"] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    archetype: Optional[str] = None
    age: Optional[str] = None
    physical_description: Optional[str] = None
    personality: Optional[str] = None
    motivation: Optional[str] = None
    secret: Optional[str] = None
    arc: Optional[str] = None


class LocationResponse(BaseModel):
    id: str
    project_id: str
    name: str
    type: Optional[str]
    description: Optional[str]
    mood: Optional[str]
    significance: Optional[str]
    visual_details: Optional[str]
    state: StructureState
    reference: Optional["LocationRefResponse"] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None
    mood: Optional[str] = None
    significance: Optional[str] = None
    visual_details: Optional[str] = None


class EpisodeSummaryResponse(BaseModel):
    id: str
    project_id: str
    episode_number: int
    title: Optional[str]
    summary: Optional[str]
    key_beats: Optional[List[str]]
    cliffhanger: Optional[str]
    emotional_arc: Optional[str]
    state: StructureState
    created_at: datetime

    class Config:
        from_attributes = True


class EpisodeSummaryUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    key_beats: Optional[List[str]] = None
    cliffhanger: Optional[str] = None
    emotional_arc: Optional[str] = None


# ============================================================================
# EPISODE SCHEMAS
# ============================================================================

class DialogueLineResponse(BaseModel):
    id: str
    scene_id: str
    character_id: Optional[str]
    character_name: Optional[str]
    line_number: int
    line_text: str
    direction: Optional[str]
    emotion: Optional[str]

    class Config:
        from_attributes = True


class SceneResponse(BaseModel):
    id: str
    episode_id: str
    location_id: Optional[str]
    scene_number: int
    title: Optional[str]
    duration_seconds: int
    time_of_day: Optional[str]
    mood: Optional[str]
    action_beats: Optional[List[str]]
    camera_notes: Optional[str]
    dialogue_lines: List[DialogueLineResponse] = []
    image_prompts_count: int = 0
    video_prompts_count: int = 0

    class Config:
        from_attributes = True


class EpisodeResponse(BaseModel):
    id: str
    project_id: str
    episode_number: int
    title: Optional[str]
    cold_open: Optional[str]
    music_cue: Optional[str]
    cliffhanger_moment: Optional[str]
    state: GenerationState
    scenes_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class EpisodeDetail(EpisodeResponse):
    """Full episode with scenes and dialogue"""
    scenes: List[SceneResponse] = []


# ============================================================================
# IMAGE PROMPT SCHEMAS
# ============================================================================

class ImagePromptResponse(BaseModel):
    id: str
    scene_id: str
    shot_number: int
    shot_type: Optional[str]
    description: Optional[str]
    prompt_text: Optional[str]
    negative_prompt: Optional[str]
    state: PromptState
    generated_image: Optional["GeneratedImageResponse"] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ImagePromptUpdate(BaseModel):
    shot_type: Optional[str] = None
    description: Optional[str] = None
    prompt_text: Optional[str] = None
    negative_prompt: Optional[str] = None


# ============================================================================
# REFERENCE IMAGE SCHEMAS
# ============================================================================

class CharacterRefResponse(BaseModel):
    id: str
    character_id: str
    prompt_text: Optional[str]
    image_path: Optional[str]
    image_url: Optional[str]
    state: MediaState
    created_at: datetime

    class Config:
        from_attributes = True


class LocationRefResponse(BaseModel):
    id: str
    location_id: str
    prompt_text: Optional[str]
    image_path: Optional[str]
    image_url: Optional[str]
    state: MediaState
    created_at: datetime

    class Config:
        from_attributes = True


class RefPromptUpdate(BaseModel):
    prompt_text: str


# ============================================================================
# GENERATED IMAGE SCHEMAS
# ============================================================================

class GeneratedImageResponse(BaseModel):
    id: str
    image_prompt_id: str
    image_path: Optional[str]
    image_url: Optional[str]
    state: MediaState
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# THUMBNAIL SCHEMAS
# ============================================================================

class ThumbnailResponse(BaseModel):
    id: str
    project_id: str
    episode_id: Optional[str]
    orientation: Optional[str]
    prompt_text: Optional[str]
    image_path: Optional[str]
    image_url: Optional[str]
    state: MediaState
    created_at: datetime

    class Config:
        from_attributes = True


class ThumbnailPromptUpdate(BaseModel):
    prompt_text: str


# ============================================================================
# VIDEO PROMPT SCHEMAS
# ============================================================================

class VideoPromptResponse(BaseModel):
    id: str
    scene_id: str
    segment_number: int
    prompt_text: Optional[str]
    duration_seconds: int
    camera_movement: Optional[str]
    reference_image_id: Optional[str]
    state: PromptState
    generated_video: Optional["GeneratedVideoResponse"] = None
    created_at: datetime

    class Config:
        from_attributes = True


class VideoPromptUpdate(BaseModel):
    prompt_text: Optional[str] = None
    duration_seconds: Optional[int] = None
    camera_movement: Optional[str] = None
    reference_image_id: Optional[str] = None


# ============================================================================
# GENERATED VIDEO SCHEMAS
# ============================================================================

class GeneratedVideoResponse(BaseModel):
    id: str
    video_prompt_id: str
    video_path: Optional[str]
    video_url: Optional[str]
    duration_seconds: Optional[float]
    state: MediaState
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# GENERATION REQUEST SCHEMAS
# ============================================================================

class GenerateIdeasRequest(BaseModel):
    setting_hint: Optional[str] = None  # Optional hint for idea generation


class CustomOutlineRequest(BaseModel):
    title: str
    setting: str
    logline: str
    hook: str
    main_conflict: str


class GenerateEpisodesRequest(BaseModel):
    batch_size: int = 5  # How many episodes to generate at once
    start_from: Optional[int] = None  # Episode number to start from


# ============================================================================
# BATCH OPERATIONS
# ============================================================================

class BatchApproveRequest(BaseModel):
    ids: List[str]


class BatchRejectRequest(BaseModel):
    ids: List[str]


# ============================================================================
# STEP PROGRESS RESPONSE
# ============================================================================

class StepProgress(BaseModel):
    current_step: int
    step_name: str
    can_proceed: bool
    blocking_reason: Optional[str] = None
    
    # Step-specific progress
    items_total: int = 0
    items_completed: int = 0
    items_pending: int = 0


STEP_NAMES = {
    1: "Generate Ideas",
    2: "Select Idea",
    3: "Generate Structure",
    4: "Approve Structure",
    5: "Generate Episode Scripts",
    6: "Generate Image Prompts",
    7: "Generate Reference Images",
    8: "Generate Images",
    9: "Generate Thumbnails",
    10: "Review Images",
    11: "Generate Video Prompts",
    12: "Generate Videos",
}


# ============================================================================
# EXPORT SCHEMAS
# ============================================================================

class ExportResponse(BaseModel):
    project_id: str
    export_path: str
    format: str  # json, zip
    created_at: datetime


# Update forward references
ProjectDetail.model_rebuild()
CharacterResponse.model_rebuild()
LocationResponse.model_rebuild()
ImagePromptResponse.model_rebuild()
VideoPromptResponse.model_rebuild()
