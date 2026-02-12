import { useState, useEffect } from 'react';
import api from '../api/client';

export default function VideosTab({ projectId }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { loadData(); }, [projectId]);

  const loadData = async () => {
    try {
      const data = await api.getVideos(projectId);
      setVideos(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateVideos = async () => {
    setGenerating(true);
    try {
      await api.generateVideos(projectId);
      alert('Videos queued (Veo 2 integration pending)');
      await loadData();
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

  return (
    <div className="tab-content">
      <div className="page-header">
        <h2>Videos</h2>
        <p>Generate video clips with Veo 2</p>
      </div>

      <div className="action-bar">
        <button onClick={generateVideos} disabled={generating} className="btn btn-primary">
          {generating ? 'Generating...' : 'Generate Videos (Veo 2)'}
        </button>
        <span>{videos.length} videos</span>
      </div>

      <div className="videos-grid">
        {videos.map(v => (
          <div key={v.id} className="video-card card">
            <span className={`badge ${v.state}`}>{v.state}</span>
            {v.video_path ? (
              <video controls>
                <source src={`http://localhost:8000/outputs/${v.video_path}`} />
              </video>
            ) : (
              <div className="placeholder">Pending generation</div>
            )}
          </div>
        ))}
        {videos.length === 0 && <p className="empty">No videos yet</p>}
      </div>
    </div>
  );
}
