import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';

export default function ExportPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [scripts, setScripts] = useState(null);
  const [prompts, setPrompts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const proj = await api.getProject(id);
      setProject(proj);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadScripts = async () => {
    const data = await api.getScriptsExport(id);
    setScripts(data);
  };

  const loadPrompts = async () => {
    const data = await api.getPromptsExport(id);
    setPrompts(data);
  };

  if (loading) return <Layout project={project}><div className="loading-page"><div className="spinner"></div></div></Layout>;

  return (
    <Layout project={project}>
      <div className="page export-page">
        <div className="page-header">
          <h1>Export Project</h1>
          <p>Download your telenovela content</p>
        </div>

        <div className="export-cards">
          <div className="export-card card">
            <h3>📄 Full Project JSON</h3>
            <p>Complete project data including all structure, scripts, prompts, and assets</p>
            <a 
              href={api.getExportUrl(id)} 
              download 
              className="btn btn-primary"
            >
              Download JSON
            </a>
          </div>

          <div className="export-card card">
            <h3>📝 Scripts Only</h3>
            <p>Episode scripts with scenes and dialogue</p>
            <button onClick={loadScripts} className="btn btn-secondary">
              Preview Scripts
            </button>
            {scripts && (
              <pre className="export-preview">
                {JSON.stringify(scripts, null, 2)}
              </pre>
            )}
          </div>

          <div className="export-card card">
            <h3>🎨 All Prompts</h3>
            <p>Image and video generation prompts</p>
            <button onClick={loadPrompts} className="btn btn-secondary">
              Preview Prompts
            </button>
            {prompts && (
              <pre className="export-preview">
                {JSON.stringify(prompts, null, 2)}
              </pre>
            )}
          </div>
        </div>

        <div className="completion-message">
          <h2>🎉 Congratulations!</h2>
          <p>Your telenovela project is ready for production.</p>
          <p>Next step: Edit in Premiere Pro with generated assets.</p>
          <Link to="/" className="btn btn-primary btn-large">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </Layout>
  );
}
