import { useState, useEffect } from 'react';
import api from '../api/client';

export default function ImagePromptsTab({ projectId }) {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { loadData(); }, [projectId]);

  const loadData = async () => {
    try {
      const data = await api.getImagePrompts(projectId);
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
      await api.generateImagePrompts(projectId);
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
        <h2>Image Prompts</h2>
        <p>Generate prompts for scene images</p>
      </div>

      <div className="action-bar">
        <button onClick={generatePrompts} disabled={generating} className="btn btn-primary">
          {generating ? 'Generating...' : prompts.length ? 'Regenerate' : 'Generate Image Prompts'}
        </button>
        <span>{prompts.length} prompts</span>
      </div>

      <div className="prompts-list">
        {prompts.map(p => (
          <div key={p.id} className="prompt-card card">
            <div className="prompt-header">
              <span>Shot {p.shot_number}</span>
              <span className={`badge ${p.state}`}>{p.state}</span>
            </div>
            <p className="description">{p.description}</p>
            <details>
              <summary>Full Prompt</summary>
              <p className="prompt-text">{p.prompt_text}</p>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}
