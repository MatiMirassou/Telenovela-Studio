"""
Gemini AI Generator Service
Handles all AI generation for the telenovela pipeline
"""

import google.generativeai as genai
import json
import re
import os
from typing import List, Dict, Any, Optional

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


class GeminiGenerator:
    """Generator service using Gemini 2.5 Pro"""
    
    def __init__(self, api_key: Optional[str] = None):
        if api_key:
            genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.5-pro-preview-06-05')
        self.generation_config = {
            "temperature": 0.9,
            "top_p": 0.95,
            "max_output_tokens": 8192,
        }
    
    def _extract_json(self, text: str) -> Any:
        """Extract JSON from text, handling markdown code blocks"""
        # Try to find JSON in code blocks
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
        if json_match:
            text = json_match.group(1)
        
        # Clean up common issues
        text = text.strip()
        
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try to find array or object boundaries
            start = text.find('[') if '[' in text else text.find('{')
            end = text.rfind(']') + 1 if ']' in text else text.rfind('}') + 1
            if start != -1 and end > start:
                try:
                    return json.loads(text[start:end])
                except:
                    pass
            raise ValueError(f"Could not parse JSON from response: {text[:500]}")
    
    async def generate(self, prompt: str) -> str:
        """Generate text response"""
        response = self.model.generate_content(
            prompt,
            generation_config=self.generation_config
        )
        return response.text
    
    async def generate_json(self, prompt: str) -> Any:
        """Generate and parse JSON response"""
        response = await self.generate(prompt)
        return self._extract_json(response)
    
    # =========================================================================
    # STEP 1: Generate Ideas
    # =========================================================================
    
    async def generate_ideas(self, setting_hint: Optional[str] = None) -> List[Dict]:
        """Generate 3 telenovela ideas"""
        prompt = f"""You are a telenovela writer for ReelShort-style vertical video content.
Generate 3 dramatically different telenovela ideas that would work as 60-90 second vertical video episodes.

{"Setting hint: " + setting_hint if setting_hint else "Generate any compelling modern settings."}

Requirements:
- Target audience: Women 25-45, global (US, LATAM, Southeast Asia)
- Must have EXTREME drama, forbidden love, betrayal, secrets
- Clickbait-worthy titles that create curiosity
- Strong visual potential for short-form video

Return ONLY valid JSON array:
[
  {{
    "title": "Literal clickbait title like 'My Husband's Secret Wife Was My Best Friend'",
    "setting": "Specific, visually rich setting",
    "logline": "One-sentence dramatic premise",
    "hook": "The shocking revelation or twist that hooks viewers",
    "main_conflict": "The central dramatic tension"
  }},
  ...
]"""
        
        return await self.generate_json(prompt)
    
    # =========================================================================
    # STEP 3: Generate Structure
    # =========================================================================
    
    async def generate_characters(self, title: str, setting: str, logline: str, 
                                   main_conflict: str, num_episodes: int) -> List[Dict]:
        """Generate main characters for the telenovela"""
        prompt = f"""You are creating characters for a {num_episodes}-episode telenovela.

SERIES: {title}
SETTING: {setting}
LOGLINE: {logline}
CONFLICT: {main_conflict}

Create 5-7 main characters with extreme, dramatic potential:

Required roles:
1. PROTAGONIST - Female lead viewers root for
2. LOVE INTEREST - The romantic partner
3. ANTAGONIST - The villain causing problems
4. RIVAL - Romantic or professional competition
5. CONFIDANT - Protagonist's trusted ally
6-7. SUPPORTING - Add depth/complications

Return ONLY valid JSON array:
[
  {{
    "name": "Full Name",
    "role": "protagonist/love_interest/antagonist/rival/confidant/supporting",
    "archetype": "The Betrayed Wife/The Secret Lover/etc",
    "age": "Age range like '28-32'",
    "physical_description": "Detailed appearance for image generation - hair, eyes, skin, build, style",
    "personality": "Key personality traits",
    "motivation": "What drives them",
    "secret": "Their hidden truth that will be revealed",
    "arc": "How they change over the series"
  }},
  ...
]"""
        
        return await self.generate_json(prompt)
    
    async def generate_locations(self, title: str, setting: str, 
                                  characters: List[Dict]) -> List[Dict]:
        """Generate key locations for the telenovela"""
        char_names = [c.get('name', 'Unknown') for c in characters]
        
        prompt = f"""Create locations for this telenovela:

SERIES: {title}
SETTING: {setting}
CHARACTERS: {', '.join(char_names)}

Create 6-8 visually distinct locations where drama unfolds:

Types needed:
- Primary location (where most action happens)
- Private spaces (bedrooms, offices for secrets)
- Public spaces (for confrontations)
- Luxury settings (wealth/status)
- Hidden/secret locations
- Emotional locations (for breakdowns, revelations)

Return ONLY valid JSON array:
[
  {{
    "name": "Location Name",
    "type": "interior/exterior",
    "description": "What this place is and looks like",
    "mood": "The emotional tone (intimate, tense, luxurious, etc)",
    "significance": "Why drama happens here",
    "visual_details": "Specific details for image generation - colors, lighting, decor, atmosphere"
  }},
  ...
]"""
        
        return await self.generate_json(prompt)
    
    async def generate_episode_arc(self, title: str, setting: str, logline: str,
                                    main_conflict: str, characters: List[Dict],
                                    locations: List[Dict], num_episodes: int) -> List[Dict]:
        """Generate episode summaries for entire series"""
        char_summary = "\n".join([
            f"- {c.get('name', 'Unknown')} ({c.get('role', 'unknown')}): {c.get('secret', 'no secret')}"
            for c in characters
        ])
        
        prompt = f"""Create a {num_episodes}-episode arc for this telenovela:

SERIES: {title}
SETTING: {setting}
LOGLINE: {logline}
CONFLICT: {main_conflict}

CHARACTERS:
{char_summary}

Structure requirements:
- Episodes 1-3: HOOK - Establish world, introduce conflict, first major twist
- Episodes 4-8: ESCALATION - Secrets revealed, alliances shift, stakes rise
- Episodes 9-15: COMPLICATIONS - Love triangles, betrayals, reversals
- Episodes 16-{num_episodes-2}: CRISIS - Everything falls apart
- Episodes {num_episodes-1}-{num_episodes}: CLIMAX & RESOLUTION - Final confrontations, satisfying ending

EVERY episode must end with a cliffhanger that makes viewers NEED the next episode.

Return ONLY valid JSON array:
[
  {{
    "episode_number": 1,
    "title": "Episode title",
    "summary": "What happens in this episode (2-3 sentences)",
    "key_beats": ["Beat 1", "Beat 2", "Beat 3"],
    "cliffhanger": "The shocking moment that ends the episode",
    "emotional_arc": "tension/romance/betrayal/revelation/etc"
  }},
  ...
]"""
        
        return await self.generate_json(prompt)
    
    # =========================================================================
    # STEP 5: Generate Episode Scripts
    # =========================================================================
    
    async def generate_episode_script(self, episode_summary: Dict, 
                                       characters: List[Dict],
                                       locations: List[Dict],
                                       previous_episodes: List[Dict] = None) -> Dict:
        """Generate full script for one episode"""
        char_info = "\n".join([
            f"- {c.get('name', 'Unknown')}: {c.get('physical_description', '')} | {c.get('personality', '')}"
            for c in characters
        ])
        
        loc_info = "\n".join([
            f"- {l.get('name', 'Unknown')}: {l.get('description', '')}"
            for l in locations
        ])
        
        prev_summary = ""
        if previous_episodes:
            prev_summary = "PREVIOUS EPISODES:\n" + "\n".join([
                f"Ep {e.get('episode_number', '?')}: {e.get('summary', '')}"
                for e in previous_episodes[-3:]  # Last 3 episodes for context
            ])
        
        prompt = f"""Write the full script for Episode {episode_summary.get('episode_number', 1)}.

EPISODE: {episode_summary.get('title', 'Untitled')}
SUMMARY: {episode_summary.get('summary', '')}
KEY BEATS: {', '.join(episode_summary.get('key_beats', []))}
CLIFFHANGER: {episode_summary.get('cliffhanger', '')}

{prev_summary}

CHARACTERS:
{char_info}

LOCATIONS:
{loc_info}

Format: 60-90 seconds total, 4-6 scenes, heavy on dialogue and reaction shots.

Return ONLY valid JSON:
{{
  "episode_number": {episode_summary.get('episode_number', 1)},
  "title": "{episode_summary.get('title', 'Untitled')}",
  "cold_open": "Brief pre-title hook moment (5-10 seconds)",
  "music_cue": "Suggested music mood",
  "scenes": [
    {{
      "scene_number": 1,
      "title": "Scene title",
      "location": "Location name from list",
      "time_of_day": "day/night/evening",
      "duration_seconds": 15,
      "mood": "tense/romantic/shocking/etc",
      "action_beats": ["What happens physically"],
      "camera_notes": "Shot suggestions",
      "dialogue": [
        {{
          "character": "Character Name",
          "line": "Dialogue text",
          "direction": "(emotional direction)",
          "emotion": "angry/sad/shocked/etc"
        }}
      ]
    }}
  ],
  "cliffhanger_moment": "The final shocking image/line"
}}"""
        
        return await self.generate_json(prompt)
    
    # =========================================================================
    # STEP 6: Generate Image Prompts
    # =========================================================================
    
    async def generate_image_prompts(self, scene: Dict, characters: List[Dict],
                                      location: Dict) -> List[Dict]:
        """Generate image prompts for a scene"""
        char_looks = {c.get('name', ''): c.get('physical_description', '') for c in characters}
        
        prompt = f"""Create image generation prompts for this scene:

SCENE: {scene.get('title', 'Untitled')}
LOCATION: {location.get('name', 'Unknown')} - {location.get('visual_details', '')}
MOOD: {scene.get('mood', 'dramatic')}
ACTION: {', '.join(scene.get('action_beats', []))}

CHARACTER APPEARANCES:
{json.dumps(char_looks, indent=2)}

Create 2-4 key shots for this scene. Each prompt should:
- Be detailed enough for AI image generation (Imagen 3)
- Include character appearances if they're in shot
- Specify lighting, camera angle, mood
- Use cinematic language

Return ONLY valid JSON array:
[
  {{
    "shot_number": 1,
    "shot_type": "wide/medium/close-up/extreme close-up",
    "description": "What this shot shows",
    "prompt_text": "Full detailed prompt for image generation including style, lighting, camera angle, characters' appearances, setting details, mood",
    "negative_prompt": "Things to avoid in the image"
  }},
  ...
]"""
        
        return await self.generate_json(prompt)
    
    # =========================================================================
    # STEP 7: Generate Reference Image Prompts
    # =========================================================================
    
    async def generate_character_ref_prompt(self, character: Dict) -> str:
        """Generate prompt for character reference image"""
        prompt = f"""Create an image generation prompt for a character reference sheet.

CHARACTER: {character.get('name', 'Unknown')}
APPEARANCE: {character.get('physical_description', '')}
PERSONALITY: {character.get('personality', '')}
ROLE: {character.get('role', '')}

Create a detailed prompt for generating a reference image showing:
- Clear face/portrait view
- Consistent with telenovela/drama aesthetic
- Professional, cinematic quality
- Suitable for use as reference in other scenes

Return ONLY the prompt text, nothing else."""
        
        response = await self.generate(prompt)
        return response.strip()
    
    async def generate_location_ref_prompt(self, location: Dict) -> str:
        """Generate prompt for location reference image"""
        prompt = f"""Create an image generation prompt for a location reference.

LOCATION: {location.get('name', 'Unknown')}
TYPE: {location.get('type', 'interior')}
DESCRIPTION: {location.get('description', '')}
VISUAL DETAILS: {location.get('visual_details', '')}
MOOD: {location.get('mood', '')}

Create a detailed prompt for generating a reference image showing:
- Establishing shot of the location
- Rich visual detail
- Cinematic quality suitable for drama
- Clear sense of space and atmosphere

Return ONLY the prompt text, nothing else."""
        
        response = await self.generate(prompt)
        return response.strip()
    
    # =========================================================================
    # STEP 9: Generate Thumbnail Prompts
    # =========================================================================
    
    async def generate_thumbnail_prompts(self, episode: Dict, 
                                          characters: List[Dict]) -> List[Dict]:
        """Generate thumbnail prompts for an episode (vertical + horizontal)"""
        main_char = next((c for c in characters if c.get('role') == 'protagonist'), characters[0] if characters else {})
        
        prompt = f"""Create thumbnail image prompts for Episode {episode.get('episode_number', 1)}.

EPISODE: {episode.get('title', 'Untitled')}
CLIFFHANGER: {episode.get('cliffhanger_moment', '')}
PROTAGONIST: {main_char.get('name', 'Unknown')} - {main_char.get('physical_description', '')}

Create 2 thumbnail prompts:
1. VERTICAL (9:16) - For TikTok/Reels/Shorts
2. HORIZONTAL (16:9) - For YouTube/standard video

Requirements:
- DRAMATIC expression/moment
- Eye-catching, clickbait-worthy
- Should make viewer NEED to watch
- Include character appearance details

Return ONLY valid JSON array:
[
  {{
    "orientation": "vertical",
    "prompt_text": "Detailed prompt for vertical thumbnail..."
  }},
  {{
    "orientation": "horizontal", 
    "prompt_text": "Detailed prompt for horizontal thumbnail..."
  }}
]"""
        
        return await self.generate_json(prompt)
    
    # =========================================================================
    # STEP 11: Generate Video Prompts
    # =========================================================================
    
    async def generate_video_prompts(self, scene: Dict, image_prompts: List[Dict],
                                      characters: List[Dict], location: Dict) -> List[Dict]:
        """Generate video prompts for a scene (for Veo 2)"""
        prompt = f"""Create video generation prompts for this scene.

SCENE: {scene.get('title', 'Untitled')}
DURATION: {scene.get('duration_seconds', 60)} seconds total
MOOD: {scene.get('mood', 'dramatic')}
ACTION: {', '.join(scene.get('action_beats', []))}

EXISTING IMAGE PROMPTS (use as reference frames):
{json.dumps([p.get('description', '') for p in image_prompts], indent=2)}

Create 2-4 video segments that could be generated with Veo 2:
- Each segment 3-8 seconds
- Describe motion, camera movement, action
- Reference which image could be the starting frame

Return ONLY valid JSON array:
[
  {{
    "segment_number": 1,
    "prompt_text": "Detailed video generation prompt describing motion and action",
    "duration_seconds": 5,
    "camera_movement": "pan/zoom/static/dolly/etc",
    "reference_image_shot": 1
  }},
  ...
]"""
        
        return await self.generate_json(prompt)


# Singleton instance
generator = GeminiGenerator()
