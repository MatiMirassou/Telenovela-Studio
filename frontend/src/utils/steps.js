/**
 * Shared step definitions for the 12-step pipeline
 */

export const STEPS = [
  { num: 1, name: 'Ideas', path: 'ideas' },
  { num: 2, name: 'Select', path: 'ideas' },
  { num: 3, name: 'Structure', path: 'structure' },
  { num: 4, name: 'Approve', path: 'structure' },
  { num: 5, name: 'Scripts', path: 'episodes' },
  { num: 6, name: 'Img Prompts', path: 'image-prompts' },
  { num: 7, name: 'References', path: 'references' },
  { num: 8, name: 'Images', path: 'images' },
  { num: 9, name: 'Thumbnails', path: 'images' },
  { num: 10, name: 'Review', path: 'review' },
  { num: 11, name: 'Vid Prompts', path: 'video-prompts' },
  { num: 12, name: 'Videos', path: 'videos' },
];

export const STEP_NAMES = {
  1: 'Generate Ideas',
  2: 'Select Idea',
  3: 'Generate Structure',
  4: 'Approve Structure',
  5: 'Generate Scripts',
  6: 'Image Prompts',
  7: 'References',
  8: 'Generate Images',
  9: 'Thumbnails',
  10: 'Review Images',
  11: 'Video Prompts',
  12: 'Generate Videos',
};

/**
 * Get the route path for a given step number
 */
export function getStepPath(step) {
  const entry = STEPS.find((s) => s.num === step);
  return entry ? entry.path : 'ideas';
}

/**
 * Get badge count for a step from pipeline data.
 * Returns the number of items needing attention for that step.
 */
export function getBadgeCount(stepNum, pipeline) {
  if (!pipeline) return 0;

  // Step 4 (Approve Structure) is a special case — combines 3 entity types
  if (stepNum === 4) {
    const chars = pipeline.characters?.counts || {};
    const locs = pipeline.locations?.counts || {};
    const eps = pipeline.episode_summaries?.counts || {};
    return (
      (chars.draft || 0) + (chars.modified || 0) +
      (locs.draft || 0) + (locs.modified || 0) +
      (eps.draft || 0) + (eps.modified || 0)
    );
  }

  // Step 7 (References) combines character_refs + location_refs
  if (stepNum === 7) {
    const cr = pipeline.character_refs?.counts || {};
    const lr = pipeline.location_refs?.counts || {};
    return (cr.pending || 0) + (lr.pending || 0);
  }

  const STEP_BADGE_MAP = {
    1: { key: 'ideas', states: ['draft'] },
    2: { key: 'ideas', states: ['draft'] },
    3: { key: 'characters', states: ['draft', 'modified'] },
    5: { key: 'episodes', states: ['pending', 'generating'] },
    6: { key: 'image_prompts', states: ['pending'] },
    8: { key: 'generated_images', states: ['pending', 'generating'] },
    9: { key: 'thumbnails', states: ['pending', 'generating'] },
    10: { key: 'generated_images', states: ['generated'] }, // "generated" = needs review
    11: { key: 'video_prompts', states: ['pending'] },
    12: { key: 'generated_videos', states: ['pending', 'generating'] },
  };

  const config = STEP_BADGE_MAP[stepNum];
  if (!config) return 0;

  const entity = pipeline[config.key];
  if (!entity) return 0;

  return config.states.reduce((sum, s) => sum + (entity.counts[s] || 0), 0);
}
