"""initial schema

Revision ID: 16d8e7e5cc41
Revises:
Create Date: 2026-02-19 14:23:48.940491

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '16d8e7e5cc41'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create all tables for fresh deployments.
    # For existing databases, init_db() already created these tables,
    # and Alembic will stamp the version without re-running.

    op.create_table('projects',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('setting', sa.Text(), nullable=True),
        sa.Column('num_episodes', sa.Integer(), nullable=True),
        sa.Column('current_step', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('app_settings',
        sa.Column('key', sa.String(), nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('key')
    )

    op.create_table('ideas',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=True),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('logline', sa.Text(), nullable=True),
        sa.Column('setting_description', sa.Text(), nullable=True),
        sa.Column('themes', sa.JSON(), nullable=True),
        sa.Column('target_audience', sa.String(), nullable=True),
        sa.Column('state', sa.Enum('GENERATED', 'APPROVED', 'REJECTED', name='ideasstate'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('characters',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=True),
        sa.Column('archetype', sa.String(), nullable=True),
        sa.Column('physical_description', sa.Text(), nullable=True),
        sa.Column('personality', sa.Text(), nullable=True),
        sa.Column('state', sa.Enum('GENERATED', 'APPROVED', 'REJECTED', name='structurestate'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('locations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('type', sa.String(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('visual_details', sa.Text(), nullable=True),
        sa.Column('state', sa.Enum('GENERATED', 'APPROVED', 'REJECTED', name='structurestate'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('episode_summaries',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=True),
        sa.Column('episode_number', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('key_beats', sa.JSON(), nullable=True),
        sa.Column('cliffhanger', sa.Text(), nullable=True),
        sa.Column('state', sa.Enum('GENERATED', 'APPROVED', 'REJECTED', name='structurestate'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('episodes',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=True),
        sa.Column('episode_number', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('cold_open', sa.Text(), nullable=True),
        sa.Column('music_cue', sa.String(), nullable=True),
        sa.Column('cliffhanger_moment', sa.Text(), nullable=True),
        sa.Column('state', sa.Enum('PENDING', 'GENERATING', 'GENERATED', 'APPROVED', name='generationstate'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('scenes',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('episode_id', sa.String(), nullable=True),
        sa.Column('location_id', sa.String(), nullable=True),
        sa.Column('scene_number', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('time_of_day', sa.String(), nullable=True),
        sa.Column('mood', sa.String(), nullable=True),
        sa.Column('action_beats', sa.JSON(), nullable=True),
        sa.Column('camera_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['episode_id'], ['episodes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['location_id'], ['locations.id']),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('dialogue_lines',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('scene_id', sa.String(), nullable=True),
        sa.Column('character_id', sa.String(), nullable=True),
        sa.Column('character_name', sa.String(), nullable=True),
        sa.Column('line_number', sa.Integer(), nullable=True),
        sa.Column('line_text', sa.Text(), nullable=True),
        sa.Column('direction', sa.String(), nullable=True),
        sa.Column('emotion', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['character_id'], ['characters.id']),
        sa.ForeignKeyConstraint(['scene_id'], ['scenes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('image_prompts',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('scene_id', sa.String(), nullable=True),
        sa.Column('prompt_number', sa.Integer(), nullable=True),
        sa.Column('prompt_text', sa.Text(), nullable=True),
        sa.Column('negative_prompt', sa.Text(), nullable=True),
        sa.Column('style_reference', sa.String(), nullable=True),
        sa.Column('state', sa.Enum('PENDING', 'GENERATING', 'GENERATED', 'APPROVED', name='generationstate'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['scene_id'], ['scenes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('character_refs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('character_id', sa.String(), nullable=True),
        sa.Column('prompt_text', sa.Text(), nullable=True),
        sa.Column('image_path', sa.String(), nullable=True),
        sa.Column('state', sa.Enum('PENDING', 'GENERATING', 'GENERATED', 'APPROVED', 'REJECTED', name='mediastate'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['character_id'], ['characters.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('location_refs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('location_id', sa.String(), nullable=True),
        sa.Column('prompt_text', sa.Text(), nullable=True),
        sa.Column('image_path', sa.String(), nullable=True),
        sa.Column('state', sa.Enum('PENDING', 'GENERATING', 'GENERATED', 'APPROVED', 'REJECTED', name='mediastate'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['location_id'], ['locations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('generated_images',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('image_prompt_id', sa.String(), nullable=True),
        sa.Column('image_path', sa.String(), nullable=True),
        sa.Column('state', sa.Enum('PENDING', 'GENERATING', 'GENERATED', 'APPROVED', 'REJECTED', name='mediastate'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['image_prompt_id'], ['image_prompts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('thumbnails',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=True),
        sa.Column('episode_number', sa.Integer(), nullable=True),
        sa.Column('prompt_text', sa.Text(), nullable=True),
        sa.Column('image_path', sa.String(), nullable=True),
        sa.Column('state', sa.Enum('PENDING', 'GENERATING', 'GENERATED', 'APPROVED', 'REJECTED', name='mediastate'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('video_prompts',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('scene_id', sa.String(), nullable=True),
        sa.Column('prompt_number', sa.Integer(), nullable=True),
        sa.Column('prompt_text', sa.Text(), nullable=True),
        sa.Column('reference_image_path', sa.String(), nullable=True),
        sa.Column('state', sa.Enum('PENDING', 'GENERATING', 'GENERATED', 'APPROVED', name='generationstate'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['scene_id'], ['scenes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('generated_videos',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('video_prompt_id', sa.String(), nullable=True),
        sa.Column('video_path', sa.String(), nullable=True),
        sa.Column('state', sa.Enum('PENDING', 'GENERATING', 'GENERATED', 'APPROVED', 'REJECTED', name='mediastate'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['video_prompt_id'], ['video_prompts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('generated_videos')
    op.drop_table('video_prompts')
    op.drop_table('thumbnails')
    op.drop_table('generated_images')
    op.drop_table('location_refs')
    op.drop_table('character_refs')
    op.drop_table('image_prompts')
    op.drop_table('dialogue_lines')
    op.drop_table('scenes')
    op.drop_table('episodes')
    op.drop_table('episode_summaries')
    op.drop_table('locations')
    op.drop_table('characters')
    op.drop_table('ideas')
    op.drop_table('app_settings')
    op.drop_table('projects')
