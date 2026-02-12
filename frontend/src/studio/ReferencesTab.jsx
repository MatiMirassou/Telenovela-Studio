import { useState, useEffect } from 'react';
import api from '../api/client';

export default function ReferencesTab({ projectId }) {
  const [charRefs, setCharRefs] = useState([]);
  const [locRefs, setLocRefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);

  useEffect(() => { loadData(); }, [projectId]);

  const loadData = async () => {
    try {
      const [chars, locs] = await Promise.all([
        api.getCharacterRefs(projectId),
        api.getLocationRefs(projectId)
      ]);
      setCharRefs(chars);
      setLocRefs(locs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateRefs = async () => {
    setGenerating(true);
    try {
      await api.generateReferences(projectId);
      await loadData();
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const generateImages = async () => {
    setGeneratingImages(true);
    try {
      await api.generateReferenceImages(projectId);
      await loadData();
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setGeneratingImages(false);
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

  return (
    <div className="tab-content">
      <div className="page-header">
        <h2>Reference Images</h2>
        <p>Generate reference images for characters and locations</p>
      </div>

      <div className="action-bar">
        <button onClick={generateRefs} disabled={generating} className="btn btn-primary">
          {generating ? 'Generating...' : 'Generate Reference Prompts'}
        </button>
        <button onClick={generateImages} disabled={generatingImages} className="btn btn-secondary">
          {generatingImages ? 'Generating...' : 'Generate Images'}
        </button>
      </div>

      <h3>Character References</h3>
      <div className="refs-grid">
        {charRefs.map(ref => (
          <div key={ref.id} className="ref-card card">
            <h4>{ref.character_name || 'Character Ref'}</h4>
            <span className={`badge ${ref.state}`}>{ref.state}</span>
            {ref.image_path && <img src={`http://localhost:8000/outputs/${ref.image_path}`} alt="" />}
            <details>
              <summary>Prompt</summary>
              <p>{ref.prompt_text}</p>
            </details>
          </div>
        ))}
        {charRefs.length === 0 && <p className="empty">No character references yet</p>}
      </div>

      <h3>Location References</h3>
      <div className="refs-grid">
        {locRefs.map(ref => (
          <div key={ref.id} className="ref-card card">
            <h4>{ref.location_name || 'Location Ref'}</h4>
            <span className={`badge ${ref.state}`}>{ref.state}</span>
            {ref.image_path && <img src={`http://localhost:8000/outputs/${ref.image_path}`} alt="" />}
            <details>
              <summary>Prompt</summary>
              <p>{ref.prompt_text}</p>
            </details>
          </div>
        ))}
        {locRefs.length === 0 && <p className="empty">No location references yet</p>}
      </div>
    </div>
  );
}
