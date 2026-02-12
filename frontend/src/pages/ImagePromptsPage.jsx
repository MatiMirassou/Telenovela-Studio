// ImagePromptsPage.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';

export default function ImagePromptsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [projectData, promptsData] = await Promise.all([
        api.getProject(id),
        api.getImagePrompts(id)
      ]);
      setProject(projectData);
      setPrompts(promptsData);
    } catch (err) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  const generatePrompts = async () => {
    setGenerating(true);
    try {
      await api.generateImagePrompts(id);
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
          <h1>Step 6: Image Prompts</h1>
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

        {prompts.length > 0 && (
          <div className="next-step-bar">
            <button onClick={() => navigate(`/projects/${id}/references`)} className="btn btn-primary btn-large">
              Generate References →
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
