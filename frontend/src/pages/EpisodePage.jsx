import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';
import { showToast } from '../components/Toast';
import { useGeneration } from '../context/GenerationContext';
import EpisodeDetailPanel from './production/EpisodeDetailPanel';

export default function EpisodePage() {
  const { id, epNum } = useParams();
  const navigate = useNavigate();
  const { startGeneration, stopGeneration } = useGeneration();

  const [project, setProject] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Episode detail state
  const [episodeDetail, setEpisodeDetail] = useState(null);
  const [screenplayText, setScreenplayText] = useState(null);

  // Global media data (loaded once, filtered per scene)
  const [allImagePrompts, setAllImagePrompts] = useState([]);
  const [allVideoPrompts, setAllVideoPrompts] = useState([]);
  const [allThumbnails, setAllThumbnails] = useState([]);

  // Generation state
  const [generatingAction, setGeneratingAction] = useState(null);
  const [pendingMediaAction, setPendingMediaAction] = useState(null);

  // Initial load
  useEffect(() => {
    loadData();
  }, [id]);

  // When episodes load or epNum changes, select the right episode
  useEffect(() => {
    if (episodes.length > 0 && epNum) {
      const ep = episodes.find(e => String(e.episode_number) === String(epNum));
      if (ep) {
        loadEpisodeDetail(ep.id);
        loadMediaData();
      }
    }
  }, [episodes, epNum]);

  const loadData = async () => {
    setError(null);
    try {
      const [proj, eps] = await Promise.all([
        api.getProject(id),
        api.getEpisodes(id),
      ]);
      setProject(proj);
      setEpisodes(eps);
    } catch (err) {
      console.error('Failed to load:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMediaData = useCallback(async () => {
    try {
      const [imgPrompts, vidPrompts, thumbs] = await Promise.all([
        api.getImagePrompts(id),
        api.getVideoPrompts(id),
        api.getThumbnails(id),
      ]);
      setAllImagePrompts(imgPrompts);
      setAllVideoPrompts(vidPrompts);
      setAllThumbnails(thumbs);
    } catch (err) {
      console.error('Failed to load media data:', err);
    }
  }, [id]);

  const loadEpisodeDetail = async (episodeId) => {
    setEpisodeDetail(null);
    setScreenplayText(null);
    try {
      const [detail, screenplay] = await Promise.all([
        api.getEpisode(episodeId),
        api.getEpisodeScreenplay(episodeId),
      ]);
      setEpisodeDetail(detail);
      setScreenplayText(screenplay.screenplay);
    } catch (err) {
      console.error('Failed to load episode detail:', err);
    }
  };

  // Find the current episode object
  const currentEpisode = episodes.find(e => String(e.episode_number) === String(epNum));

  // Group media by scene_id
  const imagePromptsByScene = useMemo(() => {
    const map = {};
    allImagePrompts.forEach(ip => {
      if (!map[ip.scene_id]) map[ip.scene_id] = [];
      map[ip.scene_id].push(ip);
    });
    return map;
  }, [allImagePrompts]);

  const videoPromptsByScene = useMemo(() => {
    const map = {};
    allVideoPrompts.forEach(vp => {
      if (!map[vp.scene_id]) map[vp.scene_id] = [];
      map[vp.scene_id].push(vp);
    });
    return map;
  }, [allVideoPrompts]);

  // Filter thumbnails for current episode
  const episodeThumbnails = useMemo(() => {
    return currentEpisode ? allThumbnails.filter(t => t.episode_id === currentEpisode.id) : [];
  }, [allThumbnails, currentEpisode]);

  // --- Episode Actions ---

  const approveEpisode = async () => {
    if (!currentEpisode) return;
    try {
      await api.approveEpisode(currentEpisode.id);
      await loadData();
      await loadEpisodeDetail(currentEpisode.id);
    } catch (err) { showToast('Failed: ' + err.message, 'error'); }
  };

  const unapproveEpisode = async () => {
    if (!currentEpisode) return;
    try {
      await api.unapproveEpisode(currentEpisode.id);
      await loadData();
      await loadEpisodeDetail(currentEpisode.id);
    } catch (err) { showToast('Failed: ' + err.message, 'error'); }
  };

  const resetEpisode = async () => {
    if (!currentEpisode) return;
    try {
      await api.resetEntity('episodes', currentEpisode.id);
      await loadData();
    } catch (err) { showToast('Failed: ' + err.message, 'error'); }
  };

  // --- Generation Actions ---

  const runGeneration = async (actionName, label, apiFn, successMsg) => {
    setGeneratingAction(actionName);
    startGeneration(label);
    try {
      const result = await apiFn();
      await loadMediaData();
      if (successMsg) {
        showToast(typeof successMsg === 'function' ? successMsg(result) : successMsg, 'success');
      }
    } catch (err) {
      showToast('Generation failed: ' + err.message, 'error');
    } finally {
      setGeneratingAction(null);
      stopGeneration();
    }
  };

  const generateImgPrompts = () => {
    runGeneration('img-prompts', 'Generating Image Prompts...', () => api.generateImagePrompts(id), 'Image prompts generated!');
  };

  const generateImages = () => {
    runGeneration('images', 'Generating Scene Images...', () => api.generateImages(id), (r) => {
      const count = r?.images_generated || 0;
      return count > 0 ? `Generated ${count} scene images!` : 'No new images generated.';
    });
  };

  const generateVidPrompts = () => {
    runGeneration('vid-prompts', 'Generating Video Prompts...', () => api.generateVideoPrompts(id), 'Video prompts generated!');
  };

  const generateVideos = () => {
    runGeneration('videos', 'Generating Videos...', () => api.generateVideos(id), 'Videos generated!');
  };

  const generateThumbnails = () => {
    runGeneration('thumbnails', 'Generating Thumbnails...', () => api.generateThumbnails(id), 'Thumbnails generated!');
  };

  // --- Media Actions (with double-click guard) ---

  const mediaAction = async (mediaId, apiFn) => {
    if (pendingMediaAction) return;
    setPendingMediaAction(mediaId);
    try { await apiFn(); await loadMediaData(); }
    catch (err) { showToast('Failed: ' + err.message, 'error'); }
    finally { setPendingMediaAction(null); }
  };

  const approveImage = (imageId) => mediaAction(imageId, () => api.approveImage(imageId));
  const rejectImage = (imageId) => mediaAction(imageId, () => api.rejectImage(imageId));
  const regenerateImage = (imageId) => mediaAction(imageId, () => api.regenerateImage(imageId));
  const approveVideo = (videoId) => mediaAction(videoId, () => api.approveVideo(videoId));
  const rejectVideo = (videoId) => mediaAction(videoId, () => api.rejectVideo(videoId));
  const regenerateVideo = (videoId) => mediaAction(videoId, () => api.regenerateVideo(videoId));
  const approveThumbnail = (thumbId) => mediaAction(thumbId, () => api.approveThumbnail(thumbId));
  const rejectThumbnail = (thumbId) => mediaAction(thumbId, () => api.rejectThumbnail(thumbId));
  const regenerateThumbnail = (thumbId) => mediaAction(thumbId, () => api.regenerateThumbnail(thumbId));

  // --- Navigation ---

  const epNumInt = parseInt(epNum, 10);
  const hasPrev = epNumInt > 1;
  const hasNext = episodes.some(e => e.episode_number === epNumInt + 1 && e.state !== 'pending');

  if (loading) {
    return <Layout project={project}><div className="loading-page"><div className="spinner"></div><p>Loading...</p></div></Layout>;
  }

  if (error) {
    return (
      <Layout project={project}>
        <div className="error-page">
          <h2>Failed to load</h2>
          <p>{error}</p>
          <button onClick={loadData} className="btn btn-primary">Retry</button>
        </div>
      </Layout>
    );
  }

  if (!currentEpisode) {
    return (
      <Layout project={project}>
        <div className="page" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2>Episode {epNum} not found</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>This episode may not have been generated yet.</p>
          <button onClick={() => navigate(`/projects/${id}/production`)} className="btn btn-primary">Back to Production</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout project={project}>
      <div className="page episode-page">
        {/* Navigation bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border)',
        }}>
          <button
            onClick={() => navigate(`/projects/${id}/production`)}
            className="btn btn-small btn-outline"
            title="Back to Production Home"
          >
            ← Production
          </button>
          <div style={{ flex: 1 }} />
          {hasPrev && (
            <button onClick={() => navigate(`/projects/${id}/production/${epNumInt - 1}`)} className="btn btn-small btn-outline">
              ← Ep {epNumInt - 1}
            </button>
          )}
          <span style={{ fontWeight: 600 }}>Episode {epNum}</span>
          {hasNext && (
            <button onClick={() => navigate(`/projects/${id}/production/${epNumInt + 1}`)} className="btn btn-small btn-outline">
              Ep {epNumInt + 1} →
            </button>
          )}
        </div>

        {/* Episode Detail Panel (reuse existing component) */}
        <EpisodeDetailPanel
          episode={currentEpisode}
          episodeDetail={episodeDetail}
          screenplayText={screenplayText}
          imagePromptsByScene={imagePromptsByScene}
          videoPromptsByScene={videoPromptsByScene}
          thumbnails={episodeThumbnails}
          generatingAction={generatingAction}
          onApproveEpisode={approveEpisode}
          onUnapproveEpisode={unapproveEpisode}
          onResetEpisode={resetEpisode}
          onGenerateImgPrompts={generateImgPrompts}
          onGenerateImages={generateImages}
          onGenerateVidPrompts={generateVidPrompts}
          onGenerateVideos={generateVideos}
          onGenerateThumbnails={generateThumbnails}
          onApproveImage={approveImage}
          onRejectImage={rejectImage}
          onRegenerateImage={regenerateImage}
          onApproveVideo={approveVideo}
          onRejectVideo={rejectVideo}
          onRegenerateVideo={regenerateVideo}
          onApproveThumbnail={approveThumbnail}
          onRejectThumbnail={rejectThumbnail}
          onRegenerateThumbnail={regenerateThumbnail}
          mediaActionDisabled={!!pendingMediaAction}
        />
      </div>
    </Layout>
  );
}
