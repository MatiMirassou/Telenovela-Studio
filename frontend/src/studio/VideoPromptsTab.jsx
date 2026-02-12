import { useState, useEffect } from 'react';
import api from '../api/client';

export default function VideoPromptsTab({ projectId }) {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { loadData(); }, [projectId]);

  const loadData = async () => {
    try {
      const data = await api.getVideoPrompts(projectId);
      setPrompts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generatePrompts = async () => {
    setGenerating(true);
    try {
      await api.generateVideoPrompts(projectId);
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
        <h2>Video Prompts</h2>
        <p>Generate prompts for video generation (Veo 2)</p>
      </div>

      <div className="action-bar">
        <button onClick={generatePrompts} disabled={generating} className="btn btn-primary">
          {generating ? 'Generating...' : 'Generate Video Prompts'}
        </button>
        <span>{prompts.length} prompts</span>
      </div>

      <div className="prompts-list">
        {prompts.map(p => (
          <div key={p.id} className="prompt-card card">
            <div className="prompt-header">
              <span>Segment {p.segment_number}</span>
              <span>{p.duration_seconds}s</span>
              <span className={`badge ${p.state}`}>{p.state}</span>
            </div>
            <p>{p.prompt_text}</p>
            {p.camera_movement && <span className="camera">{p.camera_movement}</span>}
          </div>
        ))}
        {prompts.length === 0 && <p className="empty">No video prompts yet</p>}
      </div>
    </div>
  );
}
