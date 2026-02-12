import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';

export default function VideosPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const [proj, data] = await Promise.all([
        api.getProject(id),
        api.getVideos(id)
      ]);
      setProject(proj);
      setVideos(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const generateVideos = async () => {
    setGenerating(true);
    try {
      await api.generateVideos(id);
      alert('Videos queued (Veo 2 integration pending)');
      await loadData();
    } catch (err) { alert('Failed: ' + err.message); }
    finally { setGenerating(false); }
  };

  if (loading) return <Layout project={project}><div className="loading-page"><div className="spinner"></div></div></Layout>;

  return (
    <Layout project={project}>
      <div className="page">
        <div className="page-header">
          <h1>Step 12: Generate Videos</h1>
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
              {v.video_path && (
                <video controls>
                  <source src={`http://localhost:8000/outputs/${v.video_path}`} />
                </video>
              )}
              {!v.video_path && <div className="placeholder">Pending generation</div>}
            </div>
          ))}
        </div>

        <div className="next-step-bar">
          <button onClick={() => navigate(`/projects/${id}/export`)} className="btn btn-primary btn-large">
            Export Project →
          </button>
        </div>
      </div>
    </Layout>
  );
}
