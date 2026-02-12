import { useState, useEffect } from 'react';
import api from '../api/client';

export default function OverviewTab({ project, projectId }) {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadProgress(); }, [projectId]);

  const loadProgress = async () => {
    try {
      const data = await api.getProgress(projectId);
      setProgress(data);
    } catch (err) {
      console.error('Failed to load progress:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-page"><div className="spinner"></div></div>;
  }

  return (
    <div className="tab-content overview-tab">
      <div className="page-header">
        <h1 className="gradient-title">{project?.title || 'Untitled Project'}</h1>
        {project?.setting && <p>{project.setting}</p>}
      </div>

      <div className="overview-stats">
        <div className="stat-card card">
          <span className="stat-value">{project?.num_episodes || 0}</span>
          <span className="stat-label">Total Episodes</span>
        </div>
        <div className="stat-card card">
          <span className="stat-value">{progress?.episodes_generated || project?.episodes_generated || 0}</span>
          <span className="stat-label">Scripts Written</span>
        </div>
        <div className="stat-card card">
          <span className="stat-value">{progress?.characters_count || project?.characters_count || 0}</span>
          <span className="stat-label">Characters</span>
        </div>
        <div className="stat-card card">
          <span className="stat-value">{progress?.images_pending_review || project?.images_pending_review || 0}</span>
          <span className="stat-label">Pending Review</span>
        </div>
      </div>

      {project?.logline && (
        <div className="overview-section card">
          <h3>Logline</h3>
          <p>{project.logline}</p>
        </div>
      )}

      {project?.hook && (
        <div className="overview-section card">
          <h3>Hook</h3>
          <p>{project.hook}</p>
        </div>
      )}

      {project?.main_conflict && (
        <div className="overview-section card">
          <h3>Main Conflict</h3>
          <p>{project.main_conflict}</p>
        </div>
      )}
    </div>
  );
}
