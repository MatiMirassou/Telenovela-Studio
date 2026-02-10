"""
Screenplay Formatter
Converts structured episode data (JSON/dict) into Hollywood-style screenplay format.
Pure formatting utility — no AI calls, no DB access.
"""

from typing import Dict, List, Optional


def format_episode_screenplay(episode_data: dict) -> str:
    """Convert an episode dict into formatted screenplay text.

    Expects the structure from EpisodeDetail (episodes.py _episode_to_detail):
      - episode_number, title, cold_open, music_cue, cliffhanger_moment
      - scenes[]: scene_number, title, location_name, time_of_day,
                  duration_seconds, mood, action_beats[], camera_notes,
                  dialogue_lines[]: character_name, direction, line_text, emotion
    """
    lines: List[str] = []
    ep_num = episode_data.get("episode_number", "?")
    ep_title = episode_data.get("title", "Untitled")

    # ── Episode header ──────────────────────────────────────────────
    lines.append("")
    lines.append("═" * 60)
    lines.append(f'EPISODE {ep_num}: "{ep_title}"')
    lines.append("═" * 60)
    lines.append("")

    # Music cue
    music = episode_data.get("music_cue", "")
    if music:
        lines.append(f"[Music: {music}]")
        lines.append("")

    # Cold open
    cold_open = episode_data.get("cold_open", "")
    if cold_open:
        lines.append(f"COLD OPEN: {cold_open}")
        lines.append("")

    # ── Scenes ──────────────────────────────────────────────────────
    scenes = episode_data.get("scenes", [])
    for scene in scenes:
        lines.append("─" * 60)
        lines.append("")

        # Slugline: INT/EXT. LOCATION – TIME OF DAY          [18s] [tense]
        location_name = _get_location_name(scene)
        location_type = _get_location_type(scene)
        time_of_day = (scene.get("time_of_day") or "day").upper()
        duration = scene.get("duration_seconds", "")
        mood = scene.get("mood", "")
        scene_num = scene.get("scene_number", "")

        prefix = location_type.upper() if location_type else "INT"
        slugline = f"{prefix}. {location_name.upper()} – {time_of_day}"

        # Add duration and mood tags
        tags = []
        if duration:
            tags.append(f"{duration}s")
        if mood:
            tags.append(mood)
        if tags:
            tag_str = "  ".join(f"[{t}]" for t in tags)
            # Right-align tags
            pad = max(60 - len(slugline) - len(tag_str) - 2, 2)
            slugline = slugline + " " * pad + tag_str

        lines.append(slugline)
        lines.append("")

        # Scene title (if different from location)
        scene_title = scene.get("title", "")
        if scene_title:
            lines.append(f"// Scene {scene_num}: {scene_title}")
            lines.append("")

        # Action beats — cinematic prose paragraphs
        action_beats = scene.get("action_beats") or []
        for beat in action_beats:
            if beat:
                lines.append(beat)
                lines.append("")

        # Camera work — indented with > prefix
        camera_notes = scene.get("camera_notes", "")
        if camera_notes:
            for cam_line in _wrap_text(camera_notes, width=56):
                lines.append(f"  > {cam_line}")
            lines.append("")

        # Dialogue
        dialogue_lines = scene.get("dialogue_lines") or scene.get("dialogue") or []
        for dl in dialogue_lines:
            char_name = (dl.get("character_name") or dl.get("character") or "UNKNOWN").upper()
            direction = dl.get("direction", "")
            line_text = dl.get("line_text") or dl.get("line") or ""

            # Character name — centered (indented ~20 chars)
            lines.append(f"                    {char_name}")

            # Parenthetical direction
            if direction:
                # Clean up: ensure it's wrapped in parentheses
                direction = direction.strip()
                if not direction.startswith("("):
                    direction = f"({direction})"
                if not direction.endswith(")"):
                    direction = f"{direction})"
                for dir_line in _wrap_text(direction, width=40):
                    lines.append(f"          {dir_line}")

            # Dialogue text
            for text_line in _wrap_text(line_text, width=40):
                lines.append(f"     {text_line}")

            lines.append("")

    # ── Cliffhanger ─────────────────────────────────────────────────
    cliffhanger = episode_data.get("cliffhanger_moment", "")
    if cliffhanger:
        lines.append("─" * 60)
        lines.append("")
        lines.append(f"*** CLIFFHANGER: {cliffhanger} ***")
        lines.append("")

    # End marker
    lines.append("═" * 60)
    lines.append(f"END OF EPISODE {ep_num}")
    lines.append("═" * 60)
    lines.append("")

    return "\n".join(lines)


def format_project_screenplays(project_title: str, episodes_data: list) -> str:
    """Format all episodes into a single screenplay document.

    Args:
        project_title: The series/project title
        episodes_data: List of episode dicts (same format as format_episode_screenplay expects)

    Returns:
        Full screenplay text for the entire project
    """
    lines: List[str] = []

    # Project header
    lines.append("")
    lines.append("╔" + "═" * 58 + "╗")
    title_line = project_title or "Untitled Series"
    pad = (58 - len(title_line)) // 2
    lines.append("║" + " " * pad + title_line + " " * (58 - pad - len(title_line)) + "║")
    lines.append("║" + " " * 18 + "COMPLETE SCREENPLAY" + " " * 21 + "║")
    lines.append("╚" + "═" * 58 + "╝")
    lines.append("")
    lines.append(f"Total Episodes: {len(episodes_data)}")
    lines.append("")
    lines.append("")

    # Format each episode
    for ep_data in episodes_data:
        lines.append(format_episode_screenplay(ep_data))
        lines.append("")
        lines.append("")

    return "\n".join(lines)


# ── Internal helpers ────────────────────────────────────────────────


def _get_location_name(scene: dict) -> str:
    """Extract location name from various scene dict formats."""
    # From API detail: scene has location_id but we need the name
    # The formatter receives pre-built dicts, so check multiple keys
    loc = scene.get("location_name") or scene.get("location") or "UNKNOWN LOCATION"
    if isinstance(loc, dict):
        return loc.get("name", "UNKNOWN LOCATION")
    return loc


def _get_location_type(scene: dict) -> str:
    """Extract location type (interior/exterior) from scene dict."""
    loc_type = scene.get("location_type", "")
    if loc_type:
        if loc_type.lower() in ("interior", "int"):
            return "INT"
        elif loc_type.lower() in ("exterior", "ext"):
            return "EXT"
    # Default: try to infer from time_of_day or just use INT
    return "INT"


def _wrap_text(text: str, width: int = 60) -> List[str]:
    """Word-wrap text to specified width."""
    if not text:
        return []

    words = text.split()
    lines = []
    current_line = ""

    for word in words:
        if current_line and len(current_line) + 1 + len(word) > width:
            lines.append(current_line)
            current_line = word
        else:
            current_line = f"{current_line} {word}" if current_line else word

    if current_line:
        lines.append(current_line)

    return lines if lines else [""]
