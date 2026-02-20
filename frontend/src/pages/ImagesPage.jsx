import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import StateFilterTabs from '../components/StateFilterTabs';
import api from '../api/client';

const MEDIA_STATES = [
  { value: 'pending', label: 'Pending' },
  { value: 'generating', label: 'Generating' },
  { value: 'generated', label: 'Generated' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function ImagesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [thumbnails, setThumbnails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filterState, setFilterState] = useState(null);

  useEffect(() => { loadData(); }, [id, filterState]);

  const loadData = async () => {
    try {
      const [proj, thumbs] = await Promise.all([
        api.getProject(id),
        api.getThumbnails(id, filterState ? { state: filterState } : {})
      ]);
      setProject(proj);
      setThumbnails(thumbs);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const generateImages = async () => {
    setGenerating(true);
    try {
      await api.generateImages(id);
      alert('Images queued (Imagen 3 integration pending)');
    } catch (err) { alert('Failed: ' + err.message); }
    finally { setGenerating(false); }
  };

  const generateThumbnails = async () => {
    setGenerating(true);
    try {
      await api.generateThumbnails(id);
      await loadData();
    } catch (err) { alert('Failed: ' + err.message); }
    finally { setGenerating(false); }
  };

  if (loading) return <Layout project={project}><div className="loading-page"><div className="spinner"></div></div></Layout>;

  return (
    <Layout project={project}>
      <div className="page">
        <div className="page-header">
          <h1>Steps 8-9: Images & Thumbnails</h1>
          <p>Generate scene images and episode thumbnails</p>
        </div>

        <StateFilterTabs states={MEDIA_STATES} activeState={filterState} onChange={setFilterState} />

        <div className="action-bar">
          <button onClick={generateImages} disabled={generating} className="btn btn-primary">
            Generate Scene Images (Imagen 3)
          </button>
          <button onClick={generateThumbnails} disabled={generating} className="btn btn-secondary">
            Generate Thumbnail Prompts
          </button>
        </div>

        <h2>Thumbnails ({thumbnails.length})</h2>
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
        </div>

        <div className="next-step-bar">
          <button onClick={() => navigate(`/projects/${id}/review`)} className="btn btn-primary btn-large">
            Review Images →
          </button>
        </div>
      </div>
    </Layout>
  );
}
