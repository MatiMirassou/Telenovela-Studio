import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';

export default function ReferencesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [charRefs, setCharRefs] = useState([]);
  const [locRefs, setLocRefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const [proj, chars, locs] = await Promise.all([
        api.getProject(id),
        api.getCharacterRefs(id),
        api.getLocationRefs(id)
      ]);
      setProject(proj);
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
      await api.generateReferences(id);
      await loadData();
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <Layout project={project}><div className="loading-page"><div className="spinner"></div></div></Layout>;

  return (
    <Layout project={project}>
      <div className="page">
        <div className="page-header">
          <h1>Step 7: Reference Images</h1>
          <p>Generate reference images for characters and locations</p>
        </div>

        <div className="action-bar">
          <button onClick={generateRefs} disabled={generating} className="btn btn-primary">
            {generating ? 'Generating...' : 'Generate Reference Prompts'}
          </button>
        </div>

        <h2>Character References</h2>
        <div className="refs-grid">
          {charRefs.map(ref => (
            <div key={ref.id} className="ref-card card">
              <h4>Character Ref</h4>
              <span className={`badge ${ref.state}`}>{ref.state}</span>
              {ref.image_path && <img src={`http://localhost:8000/outputs/${ref.image_path}`} alt="" />}
              <details>
                <summary>Prompt</summary>
                <p>{ref.prompt_text}</p>
              </details>
            </div>
          ))}
        </div>

        <h2>Location References</h2>
        <div className="refs-grid">
          {locRefs.map(ref => (
            <div key={ref.id} className="ref-card card">
              <h4>Location Ref</h4>
              <span className={`badge ${ref.state}`}>{ref.state}</span>
              {ref.image_path && <img src={`http://localhost:8000/outputs/${ref.image_path}`} alt="" />}
              <details>
                <summary>Prompt</summary>
                <p>{ref.prompt_text}</p>
              </details>
            </div>
          ))}
        </div>

        <div className="next-step-bar">
          <button onClick={() => navigate(`/projects/${id}/images`)} className="btn btn-primary btn-large">
            Generate Images →
          </button>
        </div>
      </div>
    </Layout>
  );
}
