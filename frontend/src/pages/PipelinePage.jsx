import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';

const ENTITY_STEP_MAP = [
  { key: 'ideas', label: 'Ideas', step: 1, path: 'ideas' },
  { key: 'characters', label: 'Characters', step: 3, path: 'structure' },
  { key: 'locations', label: 'Locations', step: 3, path: 'structure' },
  { key: 'episode_summaries', label: 'Episode Summaries', step: 3, path: 'structure' },
  { key: 'episodes', label: 'Episodes', step: 5, path: 'episodes' },
  { key: 'image_prompts', label: 'Image Prompts', step: 6, path: 'image-prompts' },
  { key: 'character_refs', label: 'Character Refs', step: 7, path: 'references' },
  { key: 'location_refs', label: 'Location Refs', step: 7, path: 'references' },
  { key: 'generated_images', label: 'Generated Images', step: 8, path: 'images' },
  { key: 'thumbnails', label: 'Thumbnails', step: 9, path: 'images' },
  { key: 'video_prompts', label: 'Video Prompts', step: 11, path: 'video-prompts' },
  { key: 'generated_videos', label: 'Generated Videos', step: 12, path: 'videos' },
];

const STATE_COLORS = {
  draft: '#6b7280',
  modified: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
  pending: '#6b7280',
  generating: '#3b82f6',
  generated: '#8b5cf6',
};

export default function PipelinePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const [proj, pipe] = await Promise.all([
        api.getProject(id),
        api.getPipeline(id)
      ]);
      setProject(proj);
      setPipeline(pipe);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const renderBar = (entityData) => {
    if (!entityData || entityData.total === 0) {
      return <div className="pipeline-bar empty"><span className="pipeline-empty">No items</span></div>;
    }
    const { counts, total } = entityData;
    return (
      <div className="pipeline-bar">
        {Object.entries(counts).map(([state, count]) => {
          if (count === 0) return null;
          return (
            <div
              key={state}
              className="pipeline-segment"
              style={{
                width: `${(count / total) * 100}%`,
                backgroundColor: STATE_COLORS[state] || '#9ca3af',
              }}
              title={`${state}: ${count}`}
            >
              {count > 0 && <span>{count}</span>}
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <Layout project={project}>
        <div className="loading-page"><div className="spinner"></div></div>
      </Layout>
    );
  }

  return (
    <Layout project={project}>
      <div className="page pipeline-page">
        <div className="page-header">
          <h1>Pipeline Overview</h1>
          <p>State distribution across all entity types</p>
        </div>

        <div className="pipeline-legend">
          {Object.entries(STATE_COLORS).map(([state, color]) => (
            <span key={state} className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: color }}></span>
              {state}
            </span>
          ))}
        </div>

        <div className="pipeline-grid">
          {ENTITY_STEP_MAP.map(({ key, label, step, path }) => {
            const data = pipeline?.[key];
            return (
              <div
                key={key}
                className="pipeline-row"
                onClick={() => navigate(`/projects/${id}/${path}`)}
              >
                <div className="pipeline-label">
                  <span className="step-num">Step {step}</span>
                  <span className="entity-name">{label}</span>
                  <span className="entity-total">{data?.total || 0}</span>
                </div>
                {renderBar(data)}
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
