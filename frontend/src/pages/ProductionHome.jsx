import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';
import { showToast } from '../components/Toast';
import { useGeneration } from '../context/GenerationContext';

export default function ProductionHome() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { startGeneration, stopGeneration } = useGeneration();

  const [project, setProject] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatingScripts, setGeneratingScripts] = useState(false);
  const [generatingAction, setGeneratingAction] = useState(null);

  useEffect(() => { loadData(); }, [id]);

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

  const totalEpisodes = project?.num_episodes || 20;
  const generatedCount = episodes.filter(e => e.state !== 'pending').length;
  const approvedCount = episodes.filter(e => e.state === 'approved').length;

  // --- Bulk Actions ---

  const generateBatch = async () => {
    setGeneratingScripts(true);
    startGeneration('Generating Episode Scripts...');
    try {
      const result = await api.generateEpisodes(id, 5);
      await loadData();
      showToast(`Generated ${result.episodes_generated} episodes. ${result.remaining} remaining.`, 'success');
    } catch (err) {
      showToast('Failed to generate: ' + err.message, 'error');
    } finally {
      setGeneratingScripts(false);
      stopGeneration();
    }
  };

  const runGeneration = async (actionName, label, apiFn, successMsg) => {
    setGeneratingAction(actionName);
    startGeneration(label);
    try {
      const result = await apiFn();
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
    if (generatedCount === 0) {
      showToast('Generate episode scripts first.', 'error');
      return;
    }
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
    if (generatedCount === 0) {
      showToast('Generate episode scripts first.', 'error');
      return;
    }
    runGeneration('thumbnails', 'Generating Thumbnails...', () => api.generateThumbnails(id), 'Thumbnails generated!');
  };

  const isGenerating = !!generatingAction || generatingScripts;

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

  return (
    <Layout project={project}>
      <div className="page production-home">
        <div className="page-header">
          <h1>Production</h1>
          <p>Generate scripts, images, videos, and thumbnails for all episodes</p>
        </div>

        {/* Progress Overview */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem' }}>Episode Progress</h3>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>{generatedCount}</span>
              <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>/ {totalEpisodes} generated</span>
            </div>
            <div>
              <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)' }}>{approvedCount}</span>
              <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>approved</span>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="progress-bar" style={{ height: 8, background: 'var(--bg)', borderRadius: 4 }}>
                <div className="progress-fill" style={{ width: `${(generatedCount / totalEpisodes) * 100}%`, height: '100%', background: 'var(--primary)', borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Bulk Generation Actions */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem' }}>Bulk Generation</h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={generateBatch} disabled={isGenerating || generatedCount >= totalEpisodes} className="btn btn-primary">
              Generate Next 5 Scripts
            </button>
            <button onClick={generateImgPrompts} disabled={isGenerating} className="btn btn-secondary">
              Generate Image Prompts
            </button>
            <button onClick={generateImages} disabled={isGenerating} className="btn btn-secondary">
              Generate Scene Images
            </button>
            <button onClick={generateVidPrompts} disabled={isGenerating} className="btn btn-secondary">
              Generate Video Prompts
            </button>
            <button onClick={generateVideos} disabled={isGenerating} className="btn btn-secondary">
              Generate Videos
            </button>
            <button onClick={generateThumbnails} disabled={isGenerating} className="btn btn-secondary">
              Generate Thumbnails
            </button>
          </div>
        </div>

        {/* Episode Grid */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem' }}>Episodes</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.75rem' }}>
            {episodes.map((ep) => (
              <div
                key={ep.id}
                onClick={() => ep.state !== 'pending' && navigate(`/projects/${id}/production/${ep.episode_number}`)}
                className="card"
                style={{
                  padding: '1rem',
                  cursor: ep.state !== 'pending' ? 'pointer' : 'default',
                  opacity: ep.state === 'pending' ? 0.5 : 1,
                  transition: 'box-shadow 0.15s, transform 0.15s',
                  border: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => { if (ep.state !== 'pending') { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Ep {ep.episode_number}</span>
                  <span className={`badge ${ep.state}`}>{ep.state}</span>
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{ep.title || 'Not generated'}</div>
              </div>
            ))}

            {/* Placeholder cards for ungenerated episodes */}
            {Array.from({ length: totalEpisodes - episodes.length }, (_, i) => (
              <div
                key={`ph-${i}`}
                className="card"
                style={{
                  padding: '1rem',
                  opacity: 0.4,
                  border: '1px dashed var(--border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Ep {episodes.length + i + 1}</span>
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Not generated</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
