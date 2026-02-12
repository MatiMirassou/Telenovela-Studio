import { useState, useEffect } from 'react';
import api from '../api/client';

export default function ImagesTab({ projectId }) {
  const [thumbnails, setThumbnails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { loadData(); }, [projectId]);

  const loadData = async () => {
    try {
      const thumbs = await api.getThumbnails(projectId);
      setThumbnails(thumbs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateImages = async () => {
    setGenerating(true);
    try {
      await api.generateImages(projectId);
      alert('Generating images with Gemini 3 Pro...');
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const generateThumbnails = async () => {
    setGenerating(true);
    try {
      await api.generateThumbnails(projectId);
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
        <h2>Images & Thumbnails</h2>
        <p>Generate scene images and episode thumbnails</p>
      </div>

      <div className="action-bar">
        <button onClick={generateImages} disabled={generating} className="btn btn-primary">
          Generate Scene Images
        </button>
        <button onClick={generateThumbnails} disabled={generating} className="btn btn-secondary">
          Generate Thumbnail Prompts
        </button>
      </div>

      <h3>Thumbnails ({thumbnails.length})</h3>
      <div className="thumbnails-grid">
        {thumbnails.map(t => (
          <div key={t.id} className="thumb-card card">
            <span className="orientation">{t.orientation}</span>
            <span className={`badge ${t.state}`}>{t.state}</span>
            {t.image_path && <img src={`http://localhost:8000/outputs/${t.image_path}`} alt="" />}
            <details>
              <summary>Prompt</summary>
              <p>{t.prompt_text}</p>
            </details>
          </div>
        ))}
        {thumbnails.length === 0 && <p className="empty">No thumbnails yet</p>}
      </div>
    </div>
  );
}
