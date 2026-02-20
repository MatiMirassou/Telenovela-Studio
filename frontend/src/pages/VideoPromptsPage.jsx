import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import StateFilterTabs from '../components/StateFilterTabs';
import api from '../api/client';

const PROMPT_STATES = [
  { value: 'pending', label: 'Pending' },
  { value: 'generated', label: 'Generated' },
  { value: 'approved', label: 'Approved' },
];

export default function VideoPromptsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filterState, setFilterState] = useState(null);

  useEffect(() => { loadData(); }, [id, filterState]);

  const loadData = async () => {
    try {
      const [proj, data] = await Promise.all([
        api.getProject(id),
        api.getVideoPrompts(id, filterState ? { state: filterState } : {})
      ]);
      setProject(proj);
      setPrompts(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const generatePrompts = async () => {
    setGenerating(true);
    try {
      await api.generateVideoPrompts(id);
      await loadData();
    } catch (err) { alert('Failed: ' + err.message); }
    finally { setGenerating(false); }
  };

  if (loading) return <Layout project={project}><div className="loading-page"><div className="spinner"></div></div></Layout>;

  return (
    <Layout project={project}>
      <div className="page">
        <div className="page-header">
          <h1>Step 11: Video Prompts</h1>
          <p>Generate prompts for video generation (Veo 2)</p>
        </div>

        <StateFilterTabs states={PROMPT_STATES} activeState={filterState} onChange={setFilterState} />

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
              <span className="camera">{p.camera_movement}</span>
            </div>
          ))}
        </div>

        <div className="next-step-bar">
          <button onClick={() => navigate(`/projects/${id}/videos`)} className="btn btn-primary btn-large">
            Generate Videos →
          </button>
        </div>
      </div>
    </Layout>
  );
}
