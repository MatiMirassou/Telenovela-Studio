"""
Gemini AI Generator Service
Handles all AI generation for the telenovela pipeline
Uses google-genai SDK with Gemini 2.5 Pro for text, Gemini 3 Pro for images, and Veo 3.1 for video
"""

import json
import re
import os
import time
import base64
import uuid
from typing import List, Dict, Any, Optional

from google import genai
from google.genai import types

# Outputs directory (relative to backend/)
OUTPUTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "outputs")

# HARDCORE SETTINGS

IMAGE_STYLE = "anime dramatic scene, cinematic lighting, high detail"

# Ensure subdirectories exist
for subdir in ["images", "refs", "thumbnails", "videos"]:
    os.makedirs(os.path.join(OUTPUTS_DIR, subdir), exist_ok=True)


class GeminiGenerator:
    """Generator service using Gemini for text, images, and video"""

    def __init__(self, api_key: Optional[str] = None):
        key = api_key or os.getenv("GEMINI_API_KEY", "")
        self.client = genai.Client(api_key=key)
        self.text_model = "gemini-3-flash-preview"
        self.image_model = "gemini-3-pro-image-preview"
        self.video_model = "veo-3.1-fast-generate-preview"
        self.generation_config = types.GenerateContentConfig(
            temperature=0.9,
            top_p=0.95,
            max_output_tokens=16384,
        )
        self.script_generation_config = types.GenerateContentConfig(
            temperature=0.9,
            top_p=0.95,
            max_output_tokens=65536,
        )

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
        response = self.client.models.generate_content(
            model=self.text_model,
            contents=prompt,
            config=self.generation_config
        )
        return response.text

    async def generate_json(self, prompt: str) -> Any:
        """Generate and parse JSON response"""
        response = await self.generate(prompt)
        return self._extract_json(response)

    # =========================================================================
    # IMAGE GENERATION (Gemini 3 Pro)
    # =========================================================================

    async def generate_image(self, prompt_text: str, save_path: str,
                              aspect_ratio: str = "16:9") -> str:
        """Generate an image using Gemini 3 Pro and save to disk.

        Args:
            prompt_text: The image generation prompt
            save_path: Full path where the image should be saved
            aspect_ratio: Aspect ratio (e.g., "16:9", "9:16", "3:4", "1:1")

        Returns:
            The save_path where the image was written
        """
        response = self.client.models.generate_content(
            model=self.image_model,
            contents=prompt_text,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(
                    aspect_ratio=aspect_ratio
                )
            )
        )

        # Extract image data from response
        for part in response.candidates[0].content.parts:
            if part.inline_data is not None:
                # Ensure directory exists
                os.makedirs(os.path.dirname(save_path), exist_ok=True)

                # Save image bytes to file
                image_bytes = part.inline_data.data
                if isinstance(image_bytes, str):
                    image_bytes = base64.b64decode(image_bytes)

                with open(save_path, "wb") as f:
                    f.write(image_bytes)

                return save_path

        raise ValueError("No image data in response")

    # =========================================================================
    # VIDEO GENERATION (Veo 3.1)
    # =========================================================================

    async def generate_video(self, prompt_text: str, save_path: str,
                              duration_seconds: int = 8,
                              aspect_ratio: str = "9:16") -> str:
        """Generate a video using Veo 3.1 and save to disk.

        Args:
            prompt_text: The video generation prompt
            save_path: Full path where the video should be saved
            duration_seconds: Video duration (4, 6, or 8)
            aspect_ratio: Aspect ratio ("16:9" or "9:16")

        Returns:
            The save_path where the video was written
        """
        # Clamp duration to valid values
        valid_durations = [4, 6, 8]
        duration_seconds = min(valid_durations, key=lambda x: abs(x - duration_seconds))

        operation = self.client.models.generate_videos(
            model=self.video_model,
            prompt=prompt_text,
            config=types.GenerateVideosConfig(
                number_of_videos=1,
                duration_seconds=duration_seconds,
                aspect_ratio=aspect_ratio,
                resolution="720p"
            )
        )

        # Poll until complete (max 5 minutes)
        max_wait = 300  # seconds
        elapsed = 0
        poll_interval = 10

        while not operation.done:
            if elapsed >= max_wait:
                raise TimeoutError(f"Video generation timed out after {max_wait}s")
            time.sleep(poll_interval)
            elapsed += poll_interval
            operation = self.client.operations.get(operation)

        # Save the generated video
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        generated_video = operation.response.generated_videos[0]
        generated_video.video.save(save_path)

        return save_path

    # =========================================================================
    # STEP 1: Generate Ideas
    # =========================================================================

    async def generate_ideas(self, setting_hint: Optional[str] = None) -> List[Dict]:
        """Generate 3 telenovela ideas"""
        setting_instruction = (
            f"IMPORTANT — The user specifically requested this theme/setting: \"{setting_hint}\"\n"
            f"ALL 3 ideas MUST revolve around this theme. Interpret it broadly but stay true to the core request.\n"
            f"You may mix it with different sub-genres below for variety."
            if setting_hint
            else "Generate any compelling modern settings. Pick 3 different categories from the list below."
        )

        prompt = f"""You are a telenovela writer for ReelShort-style vertical video content.
Generate 3 dramatically different telenovela ideas that would work as 60-90 second vertical video episodes.

{setting_instruction}

Requirements:
- Target audience: Women 25-45, global (US, LATAM, Southeast Asia)
- Must have EXTREME drama, forbidden love, betrayal, secrets
- Clickbait-worthy titles that create curiosity
- Strong visual potential for short-form video

GENRE CATEGORIES (for inspiration):
🧛 SUPERNATURAL: Vampires, werewolve, supernatural academies
👑 ROYALTY: dukes/duchesses, arranged royal marriages, palace intrigue, forbidden love with commoners
🔫 MAFIA/CRIME: Mafia boss romances, cartel drama, dangerous men with soft spots, "sold to the don", rival crime families
⚔️ MILITARY/ACTION: Hitman in love of victim, bodyguard falls for client
💼 MODERN BILLIONAIRE: CEO romances, contract marriages, office affairs, rags-to-riches, revenge on the rich
👨‍👩‍👧 FAMILY DRAMA: Evil in-laws, secret siblings, inheritance wars, switched at birth, family business betrayals
TABOO RELATIONSHIPS: In love with professor, in love with boyfriend's father

TITLE STYLE - CRITICAL: 
Titles must be LITERAL, CLICKBAITY, and immediately tell the scandal, no more than 6 to 7 words.
BAD: "Sangre y Pasión", "Dark Desires", "Forbidden Hearts"
GOOD ReelShort-style examples:
- "The Vampire King Marked Me as His Bride"
- "My Mafia Husband Has a Secret Family"  
- "The Duke's Forbidden Governess"
- "Pregnant by the Werewolf Alpha"
- "I Married a Hitman to Escape My Ex"
- "The Soldier I Saved Became My Obsession"
- "My Father-in-Law is the Mafia Boss"
- "Sold to the Cruel Prince at Midnight"
- "The Billionaire's Contract Wife Found His Twin"


Each story MUST have:
- A central ROMANTIC conflict (love triangle, forbidden love, fake relationship becomes real, enemies to lovers)
- A dramatic HOOK that makes it irresistible
- Clear STAKES (what do they lose if love fails?)

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
  Be WILDLY CREATIVE. Surprise me. Mix genres if needed (vampire mafia boss, werewolf soldier, billionaire witch). Make each idea feel fresh and unique!

RESPOND ONLY WITH JSON, NO MARKDOWN, NO EXTRA TEXT.
]"""

        return await self.generate_json(prompt)

    # =========================================================================
    # STEP 3: Generate Structure (Characters + Locations + Episodes in one call)
    # =========================================================================

    async def generate_structure(self, title: str, setting: str, logline: str,
                                  main_conflict: str, num_episodes: int) -> Dict:
        """Generate characters, locations, and episode arc in a single AI call"""
        prompt = f"""You are a production designer for ReelShort-style vertical drama series.

Based on the story outline provided, create a complete production structure.

STORY OUTLINE:
- TITLE: {title}
- SETTING: {setting}
- LOGLINE: {logline}
- CONFLICT: {main_conflict}
- EPISODES: {num_episodes}

IMPORTANT - MATCH THE SETTING/GENRE:
If the story is supernatural (vampires, werewolves), include supernatural elements in characters and locations.
If historical/royalty, use period-appropriate settings (castles, ballrooms, estates).
If mafia/crime, include dangerous underworld locations and archetypes.
If military/action, include military bases, combat scenarios, tactical elements.
Adapt EVERYTHING to match the story's genre and setting.

CONTENT RESTRICTIONS:
❌ NEVER include: human trafficking, suicide, rape, sexual assault, child abuse
✅ ALLOWED: consensual adult romance, affairs, seduction, passion, violence in action/mafia context

TITLE STYLE - Keep it LITERAL and CLICKBAITY:
BAD: "Dark Desires", "Forbidden Hearts", "Eternal Love"
GOOD: "The Vampire King Marked Me as His Bride", "My Mafia Husband's Secret Family", "Pregnant by the Werewolf Alpha"

Generate a JSON response with this EXACT structure:
{{
  "title": "Literal, clickbaity series title that tells the scandal",
  "setting": "The genre/setting (e.g., Supernatural, Historical, Mafia, Modern, etc.)",
  "characters": [
    {{
      "name": "Character Name (appropriate to setting - e.g., Lord/Lady for historical, Don for mafia)",
      "role": "Protagonist/Antagonist/Love Interest/Supporting",
      "archetype": "Setting-appropriate archetype (e.g., Alpha Werewolf, Mafia Don, Duke, Navy SEAL, Vampire Prince)",
      "age": "Age range like '28-32'",
      "physicalDescription": "Detailed description for AI image generation: age, ethnicity, build, height, hair, eyes, facial features, SETTING-APPROPRIATE clothing (period costume for historical, suits for mafia, tactical gear for military, etc.), distinctive features. Be VERY specific for consistent AI generation.",
      "personality": "Key personality traits - specific quirks, flaws, strengths",
      "motivation": "Character's desires, fears, secrets",
      "secret": "Their hidden truth that will be revealed during the series",
      "arc": "How they change over the series - from what to what"
    }}
  ],
  "locations": [
    {{
      "name": "Location Name",
      "type": "interior/exterior",
      "description": "Brief description - MUST match the setting (castle for historical, penthouse for billionaire, warehouse for mafia, etc.)",
      "mood": "The emotional tone (intimate, tense, luxurious, dangerous, etc.)",
      "significance": "Why drama happens here - what key scenes take place",
      "backgroundPrompt": "Detailed AI background prompt matching the setting: architecture style appropriate to era/genre, dramatic lighting, atmosphere, specific period-appropriate objects/furniture, color palette. Include 'empty scene, no people, cinematic dramatic lighting'."
    }}
  ],
  "episodes": [
    {{
      "number": 1,
      "title": "Episode Title (dramatic, intriguing)",
      "summary": "2-3 sentences describing the dramatic events",
      "cliffhanger": "Shocking moment that ends the episode - MUST make viewers need the next episode",
      "keyBeats": ["Beat 1", "Beat 2", "Beat 3"],
      "emotionalArc": "tension/romance/betrayal/revelation/etc"
    }}
  ]
}}

REQUIREMENTS:
- Title MUST be literal and clickbaity (NOT generic romantic names)
- Create 4-6 main characters with VERY detailed physical descriptions MATCHING THE SETTING
- Create 4-6 distinct locations with detailed prompts MATCHING THE SETTING
- Create EXACTLY {num_episodes} episodes (specified by user)
- Episodes 5, 10, 15, 20 = MAJOR turning points (big reveals, betrayals, confrontations)
- EVERY episode ends on a cliffhanger
- Make it DRAMATIC, PASSIONATE, and true to its genre

VARIETY - AVOID THESE CLICHÉS:
- Don't use "dark secret" or "hidden past" - be SPECIFIC about what the secret is
- Don't use generic episode titles like "The Beginning", "New Beginnings", "The Truth" - make them DRAMATIC and SPECIFIC
- Episode titles should hint at the drama: "She Found the Other Woman's Ring", "His Brother Was the Father", "The DNA Test Results"
- Characters should have UNIQUE traits, not just "mysterious" or "powerful" - give them quirks, flaws, specific skills
- Each cliffhanger should be SPECIFIC: not "a shocking discovery" but "she finds a pregnancy test in his desk drawer"
- Summaries should be vivid and specific, not generic plot points

RESPOND ONLY WITH THE JSON, NO MARKDOWN."""

        return await self.generate_json(prompt)

    # =========================================================================
    # STEP 5: Generate Episode Scripts (Batch)
    # =========================================================================

    async def generate_episode_scripts_batch(
        self,
        episode_summaries: List[Dict],
        characters: List[Dict],
        locations: List[Dict],
        series_title: str,
        previous_episodes: List[Dict] = None
    ) -> List[Dict]:
        """Generate scripts for multiple episodes in a single AI call (Hollywood format)"""

        # Build characters context
        chars_context = "\n".join([
            f"- {c.get('name', 'Unknown')} ({c.get('role', 'supporting')}): "
            f"{c.get('physical_description', '')} | Personality: {c.get('personality', '')}"
            for c in characters
        ])

        # Build locations context — emphasize exact name matching
        locs_context = "\n".join([
            f"- \"{l.get('name', 'Unknown')}\" ({l.get('type', 'interior')}): {l.get('description', '')}"
            for l in locations
        ])

        # Build episodes context (summaries to write)
        eps_context = "\n".join([
            f"Episode {e.get('episode_number', '?')}: \"{e.get('title', 'Untitled')}\"\n"
            f"  Summary: {e.get('summary', '')}\n"
            f"  Key Beats: {', '.join(e.get('key_beats', []))}\n"
            f"  Cliffhanger: {e.get('cliffhanger', '')}"
            for e in episode_summaries
        ])

        # Build previous episodes context for continuity
        prev_context = ""
        if previous_episodes:
            prev_context = "PREVIOUSLY (for continuity — do NOT rewrite these, just maintain story threads):\n" + "\n".join([
                f"Ep {e.get('episode_number', '?')}: {e.get('summary', '')}"
                for e in previous_episodes[-5:]
            ])

        start_ep = episode_summaries[0].get('episode_number', 1)
        end_ep = episode_summaries[-1].get('episode_number', start_ep)

        prompt = f"""You are an elite showrunner and screenwriter for premium vertical short-form drama — the kind of 90-second episodes that rack up millions of views on ReelShort, ShortMax, and similar platforms. You understand that every second counts: viewers decide in 3 seconds whether to keep watching, and the cliffhanger must make swiping away feel physically impossible.

You write with the visual precision of a cinematographer, the emotional instinct of a telenovela writer, and the pacing discipline of a TikTok creator.

═══════════════════════════════════════
SERIES: "{series_title}"
═══════════════════════════════════════

CHARACTERS — Reference these for scene composition and dialogue:
{chars_context}

LOCATIONS — Use these as scene settings. You MUST use location names EXACTLY as listed:
{locs_context}

{prev_context}

EPISODES TO WRITE:
{eps_context}


═══════════════════════════════════════
SCREENWRITING EXAMPLE
═══════════════════════════════════════
INT. DE LA VEGA MANSION – MAIN LIVING ROOM – NIGHT

The room is luxurious, but it feels cold. MARÍA LUISA (50s, elegant yet severe) paces back and forth. JULIÁN (25, handsome but tormented) holds a glass with a trembling hand.

MARÍA LUISA
(Shouting)
I don't care what you feel for that penniless girl, Julián! You are a De la Vega!

JULIÁN
(With passion)
She's the only one who has ever truly loved me, Mother! I don't care about the last name!

MARÍA LUISA
(Approaching him threateningly, whispering)
If you marry her, I swear I will disinherit you. You will lose the company, the house… everything.

Julián lets go of the glass. It shatters on the floor. Fast footsteps are heard.



═══════════════════════════════════════
SCREENWRITING CRAFT GUIDELINES
═══════════════════════════════════════

ACTION BEATS — Write vivid, present-tense cinematic prose.

DIALOGUE — Every line must do at least two things: advance the plot AND reveal character.

CAMERA WORK — Write as a shot-by-shot sequence a cinematographer could follow.


═══════════════════════════════════════
EPISODE STRUCTURE (90 seconds total)
═══════════════════════════════════════

Each episode is a complete dramatic unit with this rhythm:

SCENE 1 (15-20s) — THE HOOK
Open mid-action or with a provocative image. The audience must be locked in within 3 seconds. No slow buildups. Start with tension already present.

SCENES 2-3 (20-25s each) — ESCALATION
Raise the stakes. Introduce complications. Let characters clash. Build toward something unavoidable.

SCENE 4-5 (15-20s) — CLIMAX + CLIFFHANGER
The confrontation, the revelation, or the twist. End on the most agonizing possible moment — mid-sentence, mid-action, or with a devastating reveal that recontextualizes everything.

The cliffhanger is the MOST IMPORTANT part. It's what makes someone click "Next Episode." Write it like the last shot of a movie trailer.

═══════════════════════════════════════
CONTENT RESTRICTIONS
═══════════════════════════════════════
❌ NEVER include: human trafficking, suicide, rape, sexual assault, child abuse
✅ ALLOWED: consensual romance, affairs, seduction, passion, violence in action/mafia/supernatural context

═══════════════════════════════════════
OUTPUT FORMAT — Strict JSON
═══════════════════════════════════════

{{
  "episodes": [
    {{
      "episodeNumber": 1,
      "title": "Episode Title — Short, Punchy, Intriguing",
      "coldOpen": "Brief pre-title hook moment (the first 3-5 seconds that grab attention)",
      "musicCue": "Suggested music mood for the episode",
      "cliffhangerMoment": "The final devastating image/line that makes swiping away impossible",
      "scenes": [
        {{
          "sceneNumber": 1,
          "title": "Scene Title",
          "location": "Location Name (MUST match exactly from location list above)",
          "timeOfDay": "day/night/evening/dawn",
          "duration": 18,
          "mood": "tense/romantic/shocking/desperate/triumphant/etc",
          "actionBeats": [
            "Vivid present-tense cinematic prose describing what the camera sees. Write as if describing a movie scene — environment, character actions, body language, atmosphere.",
            "Continue with the next beat of action. Each beat should paint a clear visual picture."
          ],
          "cameraWork": "WIDE SHOT description. PUSH-IN to detail. OVER-THE-SHOULDER for dialogue. ECU on important object. Describe the full shot sequence a cinematographer could follow.",
          "dialogue": [
            {{
              "character": "CHARACTER NAME",
              "line": "Dialogue text — punchy, subtext-rich",
              "direction": "(detailed parenthetical: tone, physical action, what they're hiding)",
              "emotion": "angry/devastated/conflicted/fearful/cold/passionate/etc"
            }}
          ]
        }}
      ]
    }}
  ]
}}

IMPORTANT JSON RULES:
- "location" MUST be an exact name from the location list (not a slugline)
- "duration" MUST be an integer (seconds), not a string
- "episodeNumber" MUST match the episode numbers from the episodes to write
- "actionBeats" should be vivid cinematic prose paragraphs, NOT short stage directions
- "cameraWork" should be specific enough for a DP to shoot from

═══════════════════════════════════════
QUALITY CHECKLIST — Every episode must pass these
═══════════════════════════════════════

□ Each Episode must have 4-5 Scenes
□ First 3 seconds are visually and emotionally arresting
□ Action beats read like cinema, not stage directions
□ Dialogue reveals character — what they say AND what they avoid saying
□ Camera work is specific enough for a DP to shoot from
□ Emotional dynamics shift within the episode (not monotone intensity)
□ Cliffhanger is specific, visual, and emotionally devastating
□ Total duration = exactly 90 seconds across all scenes

═══════════════════════════════════════

Generate episodes {start_ep} through {end_ep}.
RESPOND ONLY WITH VALID JSON, NO MARKDOWN."""

        # Use higher token limit for scripts
        response = self.client.models.generate_content(
            model=self.text_model,
            contents=prompt,
            config=self.script_generation_config
        )
        data = self._extract_json(response.text)

        # Handle both wrapped {"episodes": [...]} and bare [...] formats
        if isinstance(data, dict) and "episodes" in data:
            return data["episodes"]
        elif isinstance(data, list):
            return data
        else:
            raise ValueError(f"Unexpected script response format: {type(data)}")

    # =========================================================================
    # STEP 6: Generate Image Prompts
    # =========================================================================

    async def generate_episode_image_prompts(self, episode_title: str,
                                               scenes: List[Dict],
                                               characters: List[Dict]) -> List[Dict]:
        """Generate image prompts for ALL scenes in an episode in one AI call"""
        char_looks = {c.get('name', ''): c.get('physical_description', '') for c in characters}
        style = IMAGE_STYLE

        # Build scene descriptions
        scene_blocks = []
        for s in scenes:
            loc = s.get('location', {})
            loc_str = f"{loc.get('name', 'Unknown')} - {loc.get('visual_details', '')}" if loc else "Unknown"
            scene_blocks.append(
                f"SCENE {s.get('scene_number', '?')}: {s.get('title', 'Untitled')}\n"
                f"  LOCATION: {loc_str}\n"
                f"  MOOD: {s.get('mood', 'dramatic')}\n"
                f"  ACTION: {', '.join(s.get('action_beats', []))}"
            )
        scenes_text = "\n\n".join(scene_blocks)

        prompt = f"""Create image generation prompts for ALL scenes in this episode.

EPISODE: {episode_title}

CHARACTER APPEARANCES:
{json.dumps(char_looks, indent=2)}

{scenes_text}

For EACH scene above, create 4-6 key shots. Each prompt should:
- Shot sequence tells a visual story: establish -> action -> reaction -> peak
- Dont detail too much the characters, a reference will be included
- Include character appearances if they're in shot
- Specify lighting, camera angle, mood
- Use cinematic language
- Make sure to add at the end of each prompt_text: "cinematic movie frame/shot, vertical 9 by 16, {style}"

Return ONLY valid JSON — an array of scene objects, each containing its shots:
[
  {{
    "scene_number": 1,
    "shots": [
      {{
        "shot_number": 1,
        "shot_type": "wide/medium/close-up/extreme close-up",
        "description": "What this shot shows",
        "prompt_text": "Full detailed prompt for image generation including style, lighting, camera angle, characters' appearances, setting details, mood. cinematic movie frame/shot, vertical 9 by 16, {style}",
        "negative_prompt": "Things to avoid in the image"
      }}
    ]
  }}
]

RESPOND ONLY WITH JSON, NO MARKDOWN, NO EXTRA TEXT."""

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
        """Generate video prompts for a scene (for Veo 3.1)"""
        prompt = f"""Create video generation prompts for this scene.

SCENE: {scene.get('title', 'Untitled')}
DURATION: {scene.get('duration_seconds', 60)} seconds total
MOOD: {scene.get('mood', 'dramatic')}
ACTION: {', '.join(scene.get('action_beats', []))}

EXISTING IMAGE PROMPTS (use as reference frames):
{json.dumps([p.get('description', '') for p in image_prompts], indent=2)}

Create 2-4 video segments that could be generated with Veo 3.1:
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
