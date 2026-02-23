import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';
import { showToast } from '../components/Toast';
import EpisodeSidebar from './production/EpisodeSidebar';
import EpisodeDetailPanel from './production/EpisodeDetailPanel';

export default function ProductionTab() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatingScripts, setGeneratingScripts] = useState(false);

  // Selected episode state
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(null);
  const [episodeDetail, setEpisodeDetail] = useState(null);
  const [screenplayText, setScreenplayText] = useState(null);

  // Global media data (loaded once, filtered per scene)
  const [allImagePrompts, setAllImagePrompts] = useState([]);
  const [allVideoPrompts, setAllVideoPrompts] = useState([]);
  const [allThumbnails, setAllThumbnails] = useState([]);
  const [mediaLoaded, setMediaLoaded] = useState(false);

  // Generation state
  const [generatingAction, setGeneratingAction] = useState(null);
  const [pendingMediaAction, setPendingMediaAction] = useState(null); // tracks media ID being acted on

  // Race condition guard: track latest requested episode ID
  const latestEpisodeRequest = useRef(null);

  // Initial load + reset state on project change
  useEffect(() => {
    setMediaLoaded(false);
    setSelectedEpisodeId(null);
    setEpisodeDetail(null);
    setScreenplayText(null);
    loadEpisodes();
  }, [id]);

  const loadEpisodes = async () => {
    setError(null);
    try {
      const [proj, eps] = await Promise.all([
        api.getProject(id),
        api.getEpisodes(id),
      ]);
      setProject(proj);
      setEpisodes(eps);
    } catch (err) {
      console.error('Failed to load episodes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load all media data (image prompts, video prompts, thumbnails)
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
      setMediaLoaded(true);
    } catch (err) {
      console.error('Failed to load media data:', err);
    }
  }, [id]);

  // Load episode detail when selected (with race condition guard)
  const selectEpisode = useCallback(async (episodeId) => {
    latestEpisodeRequest.current = episodeId;
    setSelectedEpisodeId(episodeId);
    setEpisodeDetail(null);
    setScreenplayText(null);

    // Load media data on first episode selection
    if (!mediaLoaded) {
      loadMediaData();
    }

    try {
      const [detail, screenplay] = await Promise.all([
        api.getEpisode(episodeId),
        api.getEpisodeScreenplay(episodeId),
      ]);
      // Only update if this is still the latest request
      if (latestEpisodeRequest.current === episodeId) {
        setEpisodeDetail(detail);
        setScreenplayText(screenplay.screenplay);
      }
    } catch (err) {
      console.error('Failed to load episode detail:', err);
    }
  }, [mediaLoaded, loadMediaData]);

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

  // Filter thumbnails for selected episode
  const episodeThumbnails = useMemo(() => {
    return allThumbnails.filter(t => t.episode_id === selectedEpisodeId);
  }, [allThumbnails, selectedEpisodeId]);

  // Find selected episode object
  const selectedEpisode = episodes.find(e => e.id === selectedEpisodeId);

  // --- Actions ---

  const generateBatch = async () => {
    setGeneratingScripts(true);
    try {
      const result = await api.generateEpisodes(id, 5);
      await loadEpisodes();
      showToast(`Generated ${result.episodes_generated} episodes. ${result.remaining} remaining.`, 'success');
    } catch (err) {
      showToast('Failed to generate: ' + err.message, 'error');
    } finally {
      setGeneratingScripts(false);
    }
  };

  const approveEpisode = async () => {
    try { await api.approveEpisode(selectedEpisodeId); await loadEpisodes(); await selectEpisode(selectedEpisodeId); }
    catch (err) { showToast('Failed: ' + err.message, 'error'); }
  };
  const unapproveEpisode = async () => {
    try { await api.unapproveEpisode(selectedEpisodeId); await loadEpisodes(); await selectEpisode(selectedEpisodeId); }
    catch (err) { showToast('Failed: ' + err.message, 'error'); }
  };
  const resetEpisode = async () => {
    try { await api.resetEntity('episodes', selectedEpisodeId); await loadEpisodes(); }
    catch (err) { showToast('Failed: ' + err.message, 'error'); }
  };

  // Project-level generation actions with prerequisite checks
  const runGeneration = async (actionName, apiFn, successMsg) => {
    setGeneratingAction(actionName);
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
    }
  };

  const generateImgPrompts = () => {
    const generatedEps = episodes.filter(e => e.state !== 'pending');
    if (generatedEps.length === 0) {
      showToast('You need to generate episode scripts first before creating image prompts.', 'error');
      return;
    }
    runGeneration('img-prompts', () => api.generateImagePrompts(id), 'Image prompts generated! You can now see them in each scene.');
  };

  const generateImages = () => {
    if (allImagePrompts.length === 0) {
      showToast('Generate image prompts first before generating scene images.', 'error');
      return;
    }
    runGeneration('images', () => api.generateImages(id), (r) => {
      const count = r?.images_generated || 0;
      return count > 0
        ? `Generated ${count} scene images! Scroll through scenes to review them.`
        : 'No new images generated. Image prompts may need to be approved first, or images already exist.';
    });
  };

  const generateVidPrompts = () => {
    if (allImagePrompts.length === 0) {
      showToast('Generate image prompts first before creating video prompts.', 'error');
      return;
    }
    runGeneration('vid-prompts', () => api.generateVideoPrompts(id), 'Video prompts generated! You can see them in each scene.');
  };

  const generateVideos = () => {
    if (allVideoPrompts.length === 0) {
      showToast('Generate video prompts first before generating videos.', 'error');
      return;
    }
    runGeneration('videos', () => api.generateVideos(id), 'Videos generated!');
  };

  const generateThumbnails = () => {
    const generatedEps = episodes.filter(e => e.state !== 'pending');
    if (generatedEps.length === 0) {
      showToast('Generate episode scripts first before creating thumbnails.', 'error');
      return;
    }
    runGeneration('thumbnails', () => api.generateThumbnails(id), 'Thumbnails generated! Scroll down to see them.');
  };

  // Media approve/reject/regenerate (with double-click guard)
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

  if (loading) {
    return (
      <Layout project={project}>
        <div className="loading-page"><div className="spinner"></div><p>Loading...</p></div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout project={project}>
        <div className="error-page">
          <h2>Failed to load</h2>
          <p>{error}</p>
          <button onClick={loadEpisodes} className="btn btn-primary">Retry</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout project={project}>
      <div className="production-tab">
        <EpisodeSidebar
          episodes={episodes}
          totalEpisodes={project?.num_episodes || 20}
          selectedEpisodeId={selectedEpisodeId}
          onSelectEpisode={selectEpisode}
          onGenerateBatch={generateBatch}
          generating={generatingScripts}
        />

        <EpisodeDetailPanel
          episode={selectedEpisode}
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
