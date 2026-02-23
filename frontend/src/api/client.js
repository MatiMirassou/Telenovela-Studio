/**
 * API Client for Telenovela Agent v2
 * Uses VITE_API_URL env var in dev, falls back to same-origin in production
 */

export const API_BASE = import.meta.env.VITE_API_URL || '';

class ApiClient {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;

    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers,
      },
      ...options,
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, config);

    if (!response.ok) {
      // On 401, clear token and signal auth needed
      if (response.status === 401) {
        localStorage.removeItem('auth_token');
        // Reload to trigger the auth check in App.jsx
        window.location.reload();
      }

      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // =========================================================================
  // AUTH
  // =========================================================================

  async getAuthStatus() {
    // This request should NOT include auth token (it's a pre-auth check)
    const url = `${API_BASE}/auth/status`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Auth check failed');
    return response.json();
  }

  async login(password) {
    // This request should NOT include auth token
    const url = `${API_BASE}/login`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(error.detail || 'Login failed');
    }
    return response.json();
  }

  // =========================================================================
  // SETTINGS
  // =========================================================================

  async getApiKeyStatus() {
    return this.request('/settings/api-key/status');
  }

  async setApiKey(apiKey) {
    return this.request('/settings/api-key', {
      method: 'POST',
      body: { api_key: apiKey },
    });
  }

  async deleteApiKey() {
    return this.request('/settings/api-key', { method: 'DELETE' });
  }

  // =========================================================================
  // PROJECTS
  // =========================================================================

  async getProjects() {
    return this.request('/projects');
  }

  async getProject(id) {
    return this.request(`/projects/${id}`);
  }

  async createProject(data = {}) {
    return this.request('/projects', {
      method: 'POST',
      body: data,
    });
  }

  async updateProject(id, data) {
    return this.request(`/projects/${id}`, { method: 'PATCH', body: data });
  }

  async deleteProject(id) {
    return this.request(`/projects/${id}`, { method: 'DELETE' });
  }

  async getProgress(projectId) {
    return this.request(`/projects/${projectId}/progress`);
  }

  async advanceStep(projectId) {
    return this.request(`/projects/${projectId}/advance-step`, { method: 'POST' });
  }

  async getPipeline(projectId) {
    return this.request(`/projects/${projectId}/pipeline`);
  }

  // =========================================================================
  // IDEAS (Step 1-2)
  // =========================================================================

  async getIdeas(projectId, { state } = {}) {
    const params = state ? `?state=${state}` : '';
    return this.request(`/projects/${projectId}/ideas${params}`);
  }

  async generateIdeas(projectId, settingHint = null) {
    return this.request(`/projects/${projectId}/ideas/generate`, {
      method: 'POST',
      body: settingHint ? { setting_hint: settingHint } : {},
    });
  }

  async addCustomIdea(projectId, ideaData) {
    return this.request(`/projects/${projectId}/ideas/custom`, {
      method: 'POST',
      body: ideaData,
    });
  }

  async approveIdea(ideaId) {
    return this.request(`/ideas/${ideaId}/approve`, { method: 'POST' });
  }

  async rejectIdea(ideaId) {
    return this.request(`/ideas/${ideaId}/reject`, { method: 'POST' });
  }

  // =========================================================================
  // STRUCTURE (Step 3-4)
  // =========================================================================

  async generateStructure(projectId) {
    return this.request(`/projects/${projectId}/structure/generate`, { method: 'POST' });
  }

  async approveAllStructure(projectId) {
    return this.request(`/projects/${projectId}/structure/approve-all`, { method: 'POST' });
  }

  async getCharacters(projectId, { state } = {}) {
    const params = state ? `?state=${state}` : '';
    return this.request(`/projects/${projectId}/characters${params}`);
  }

  async updateCharacter(characterId, data) {
    return this.request(`/characters/${characterId}`, {
      method: 'PUT',
      body: data,
    });
  }

  async approveCharacter(characterId) {
    return this.request(`/characters/${characterId}/approve`, { method: 'POST' });
  }

  async getLocations(projectId, { state } = {}) {
    const params = state ? `?state=${state}` : '';
    return this.request(`/projects/${projectId}/locations${params}`);
  }

  async updateLocation(locationId, data) {
    return this.request(`/locations/${locationId}`, {
      method: 'PUT',
      body: data,
    });
  }

  async approveLocation(locationId) {
    return this.request(`/locations/${locationId}/approve`, { method: 'POST' });
  }

  async getEpisodeSummaries(projectId, { state } = {}) {
    const params = state ? `?state=${state}` : '';
    return this.request(`/projects/${projectId}/episode-summaries${params}`);
  }

  async updateEpisodeSummary(summaryId, data) {
    return this.request(`/episode-summaries/${summaryId}`, {
      method: 'PUT',
      body: data,
    });
  }

  async approveEpisodeSummary(summaryId) {
    return this.request(`/episode-summaries/${summaryId}/approve`, { method: 'POST' });
  }

  // =========================================================================
  // EPISODES (Step 5)
  // =========================================================================

  async getEpisodes(projectId, { state } = {}) {
    const params = state ? `?state=${state}` : '';
    return this.request(`/projects/${projectId}/episodes${params}`);
  }

  async getEpisode(episodeId) {
    return this.request(`/episodes/${episodeId}`);
  }

  async generateEpisodes(projectId, batchSize = 5) {
    return this.request(`/projects/${projectId}/episodes/generate`, {
      method: 'POST',
      body: { batch_size: batchSize },
    });
  }

  async approveEpisode(episodeId) {
    return this.request(`/episodes/${episodeId}/approve`, { method: 'POST' });
  }

  // =========================================================================
  // IMAGE PROMPTS (Step 6)
  // =========================================================================

  async getImagePrompts(projectId, { state } = {}) {
    const params = state ? `?state=${state}` : '';
    return this.request(`/projects/${projectId}/image-prompts${params}`);
  }

  async generateImagePrompts(projectId) {
    return this.request(`/projects/${projectId}/image-prompts/generate`, { method: 'POST' });
  }

  async updateImagePrompt(promptId, data) {
    return this.request(`/image-prompts/${promptId}`, {
      method: 'PUT',
      body: data,
    });
  }

  async approveImagePrompt(promptId) {
    return this.request(`/image-prompts/${promptId}/approve`, { method: 'POST' });
  }

  // =========================================================================
  // REFERENCES (Step 7)
  // =========================================================================

  async getCharacterRefs(projectId, { state } = {}) {
    const params = state ? `?state=${state}` : '';
    return this.request(`/projects/${projectId}/character-refs${params}`);
  }

  async getLocationRefs(projectId, { state } = {}) {
    const params = state ? `?state=${state}` : '';
    return this.request(`/projects/${projectId}/location-refs${params}`);
  }

  async generateReferences(projectId) {
    return this.request(`/projects/${projectId}/references/generate`, { method: 'POST' });
  }

  async generateReferenceImages(projectId) {
    return this.request(`/projects/${projectId}/references/generate-images`, { method: 'POST' });
  }

  async updateCharacterRefPrompt(refId, promptText) {
    return this.request(`/character-refs/${refId}/prompt`, {
      method: 'PUT',
      body: { prompt_text: promptText },
    });
  }

  async approveCharacterRef(refId) {
    return this.request(`/character-refs/${refId}/approve`, { method: 'POST' });
  }

  async rejectCharacterRef(refId) {
    return this.request(`/character-refs/${refId}/reject`, { method: 'POST' });
  }

  async regenerateCharacterRef(refId) {
    return this.request(`/character-refs/${refId}/regenerate`, { method: 'POST' });
  }

  async updateLocationRefPrompt(refId, promptText) {
    return this.request(`/location-refs/${refId}/prompt`, {
      method: 'PUT',
      body: { prompt_text: promptText },
    });
  }

  async approveLocationRef(refId) {
    return this.request(`/location-refs/${refId}/approve`, { method: 'POST' });
  }

  async rejectLocationRef(refId) {
    return this.request(`/location-refs/${refId}/reject`, { method: 'POST' });
  }

  async regenerateLocationRef(refId) {
    return this.request(`/location-refs/${refId}/regenerate`, { method: 'POST' });
  }

  // =========================================================================
  // IMAGES (Step 8)
  // =========================================================================

  async generateImages(projectId) {
    return this.request(`/projects/${projectId}/images/generate`, { method: 'POST' });
  }

  async approveImage(imageId) {
    return this.request(`/generated-images/${imageId}/approve`, { method: 'POST' });
  }

  async rejectImage(imageId) {
    return this.request(`/generated-images/${imageId}/reject`, { method: 'POST' });
  }

  async regenerateImage(imageId) {
    return this.request(`/generated-images/${imageId}/regenerate`, { method: 'POST' });
  }

  // =========================================================================
  // THUMBNAILS (Step 9)
  // =========================================================================

  async getThumbnails(projectId, { state } = {}) {
    const params = state ? `?state=${state}` : '';
    return this.request(`/projects/${projectId}/thumbnails${params}`);
  }

  async generateThumbnails(projectId) {
    return this.request(`/projects/${projectId}/thumbnails/generate`, { method: 'POST' });
  }

  async updateThumbnailPrompt(thumbId, promptText) {
    return this.request(`/thumbnails/${thumbId}/prompt`, {
      method: 'PUT',
      body: { prompt_text: promptText },
    });
  }

  async approveThumbnail(thumbId) {
    return this.request(`/thumbnails/${thumbId}/approve`, { method: 'POST' });
  }

  async rejectThumbnail(thumbId) {
    return this.request(`/thumbnails/${thumbId}/reject`, { method: 'POST' });
  }

  async regenerateThumbnail(thumbId) {
    return this.request(`/thumbnails/${thumbId}/regenerate`, { method: 'POST' });
  }

  // =========================================================================
  // REVIEW (Step 10)
  // =========================================================================

  async getImagesForReview(projectId) {
    return this.request(`/projects/${projectId}/images/review`);
  }

  // =========================================================================
  // VIDEO PROMPTS (Step 11)
  // =========================================================================

  async getVideoPrompts(projectId, { state } = {}) {
    const params = state ? `?state=${state}` : '';
    return this.request(`/projects/${projectId}/video-prompts${params}`);
  }

  async generateVideoPrompts(projectId) {
    return this.request(`/projects/${projectId}/video-prompts/generate`, { method: 'POST' });
  }

  async updateVideoPrompt(promptId, data) {
    return this.request(`/video-prompts/${promptId}`, {
      method: 'PUT',
      body: data,
    });
  }

  async approveVideoPrompt(promptId) {
    return this.request(`/video-prompts/${promptId}/approve`, { method: 'POST' });
  }

  // =========================================================================
  // VIDEOS (Step 12)
  // =========================================================================

  async getVideos(projectId, { state } = {}) {
    const params = state ? `?state=${state}` : '';
    return this.request(`/projects/${projectId}/videos${params}`);
  }

  async generateVideos(projectId) {
    return this.request(`/projects/${projectId}/videos/generate`, { method: 'POST' });
  }

  async approveVideo(videoId) {
    return this.request(`/generated-videos/${videoId}/approve`, { method: 'POST' });
  }

  async rejectVideo(videoId) {
    return this.request(`/generated-videos/${videoId}/reject`, { method: 'POST' });
  }

  async regenerateVideo(videoId) {
    return this.request(`/generated-videos/${videoId}/regenerate`, { method: 'POST' });
  }

  // =========================================================================
  // RECOVERY (reset stuck entities)
  // =========================================================================

  async resetEntity(entityType, entityId) {
    return this.request(`/${entityType}/${entityId}/reset`, { method: 'POST' });
  }

  async getStuckEntities(projectId, minutes = 10) {
    return this.request(`/projects/${projectId}/stuck?minutes=${minutes}`);
  }

  // =========================================================================
  // UNAPPROVE (rollback approved items for re-editing)
  // =========================================================================

  async unapproveCharacter(characterId) {
    return this.request(`/characters/${characterId}/unapprove`, { method: 'POST' });
  }

  async unapproveLocation(locationId) {
    return this.request(`/locations/${locationId}/unapprove`, { method: 'POST' });
  }

  async unapproveEpisodeSummary(summaryId) {
    return this.request(`/episode-summaries/${summaryId}/unapprove`, { method: 'POST' });
  }

  async unapproveEpisode(episodeId) {
    return this.request(`/episodes/${episodeId}/unapprove`, { method: 'POST' });
  }

  // =========================================================================
  // EXPORT
  // =========================================================================

  getExportUrl(projectId) {
    return `${API_BASE}/projects/${projectId}/export`;
  }

  async getScriptsExport(projectId) {
    return this.request(`/projects/${projectId}/export/scripts`);
  }

  async getPromptsExport(projectId) {
    return this.request(`/projects/${projectId}/export/prompts`);
  }

  getScreenplayExportUrl(projectId) {
    return `${API_BASE}/projects/${projectId}/export/screenplay`;
  }

  async getEpisodeScreenplay(episodeId) {
    return this.request(`/episodes/${episodeId}/screenplay`);
  }
}

export const api = new ApiClient();
export default api;
