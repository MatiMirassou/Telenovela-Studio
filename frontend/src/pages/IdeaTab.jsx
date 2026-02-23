import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';
import { showToast } from '../components/Toast';

export default function IdeaTab() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [settingHint, setSettingHint] = useState('');
  const [numEpisodes, setNumEpisodes] = useState(20);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customIdea, setCustomIdea] = useState({
    title: '',
    setting: '',
    logline: '',
    hook: '',
    main_conflict: ''
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setError(null);
    try {
      const [projectData, ideasData] = await Promise.all([
        api.getProject(id),
        api.getIdeas(id)
      ]);
      setProject(projectData);
      setIdeas(ideasData);
      if (projectData?.num_episodes) {
        setNumEpisodes(projectData.num_episodes);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateIdeas = async () => {
    setGenerating(true);
    try {
      const newIdeas = await api.generateIdeas(id, settingHint || null);
      setIdeas(newIdeas);
      const projectData = await api.getProject(id);
      setProject(projectData);
    } catch (err) {
      console.error('Failed to generate ideas:', err);
      showToast('Failed to generate ideas: ' + err.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const selectIdea = async (ideaId) => {
    try {
      await api.approveIdea(ideaId);
      await loadData();
    } catch (err) {
      console.error('Failed to select idea:', err);
      showToast('Failed to select idea', 'error');
    }
  };

  const addCustomIdea = async () => {
    try {
      const newIdea = await api.addCustomIdea(id, customIdea);
      setIdeas([...ideas, newIdea]);
      setShowCustomForm(false);
      setCustomIdea({ title: '', setting: '', logline: '', hook: '', main_conflict: '' });
    } catch (err) {
      console.error('Failed to add custom idea:', err);
      showToast('Failed to add custom idea', 'error');
    }
  };

  const proceedToStructure = async () => {
    try {
      await api.updateProject(id, { num_episodes: numEpisodes });
      navigate(`/projects/${id}/structure`);
    } catch (err) {
      console.error('Failed to update project:', err);
      showToast('Failed to update episode count: ' + err.message, 'error');
    }
  };

  const selectedIdea = ideas.find(i => i.state === 'approved');

  if (loading) {
    return (
      <Layout project={project}>
        <div className="loading-page"><div className="spinner"></div><p>Loading...</p></div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout project={project}>
        <div className="error-page">
          <h2>Failed to load</h2>
          <p>{error}</p>
          <button onClick={loadData} className="btn btn-primary">Retry</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout project={project}>
      <div className="page ideas-page">
        <div className="page-header">
          <h1>Idea</h1>
          <p>Generate telenovela concepts and select one to develop</p>
        </div>

        {!selectedIdea && (
          <div className="generation-controls">
            <div className="input-group">
              <input
                type="text"
                placeholder="Optional: Setting hint (e.g., 'billionaire romance', 'family secrets')"
                value={settingHint}
                onChange={(e) => setSettingHint(e.target.value)}
                disabled={generating}
              />
              <button
                onClick={generateIdeas}
                disabled={generating}
                className="btn btn-primary"
              >
                {generating ? 'Generating...' : ideas.length ? 'Regenerate Ideas' : 'Generate Ideas'}
              </button>
            </div>
            <button
              onClick={() => setShowCustomForm(!showCustomForm)}
              className="btn btn-secondary"
            >
              {showCustomForm ? 'Cancel' : 'Add Custom Idea'}
            </button>
          </div>
        )}

        {showCustomForm && (
          <div className="custom-idea-form card">
            <h3>Add Custom Idea</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Title</label>
                <input type="text" value={customIdea.title} onChange={(e) => setCustomIdea({...customIdea, title: e.target.value})} placeholder="Clickbait-worthy title" />
              </div>
              <div className="form-group">
                <label>Setting</label>
                <input type="text" value={customIdea.setting} onChange={(e) => setCustomIdea({...customIdea, setting: e.target.value})} placeholder="Where does it take place?" />
              </div>
              <div className="form-group full-width">
                <label>Logline</label>
                <textarea value={customIdea.logline} onChange={(e) => setCustomIdea({...customIdea, logline: e.target.value})} placeholder="One-sentence premise" />
              </div>
              <div className="form-group full-width">
                <label>Hook</label>
                <textarea value={customIdea.hook} onChange={(e) => setCustomIdea({...customIdea, hook: e.target.value})} placeholder="The twist that hooks viewers" />
              </div>
              <div className="form-group full-width">
                <label>Main Conflict</label>
                <textarea value={customIdea.main_conflict} onChange={(e) => setCustomIdea({...customIdea, main_conflict: e.target.value})} placeholder="Central dramatic tension" />
              </div>
            </div>
            <button onClick={addCustomIdea} className="btn btn-primary">Add Idea</button>
          </div>
        )}

        {ideas.length > 0 && (
          <div className="ideas-grid">
            {ideas.map((idea) => (
              <div
                key={idea.id}
                className={`idea-card card ${idea.state === 'approved' ? 'selected' : ''} ${idea.state === 'rejected' ? 'rejected' : ''}`}
              >
                <div className="idea-header">
                  <h3>{idea.title}</h3>
                  {idea.state === 'approved' && <span className="badge badge-success">Selected</span>}
                  {idea.state === 'rejected' && <span className="badge badge-muted">Not Selected</span>}
                </div>
                <div className="idea-field"><label>Setting</label><p>{idea.setting}</p></div>
                <div className="idea-field"><label>Logline</label><p>{idea.logline}</p></div>
                <div className="idea-field"><label>Hook</label><p>{idea.hook}</p></div>
                <div className="idea-field"><label>Main Conflict</label><p>{idea.main_conflict}</p></div>
                {idea.state === 'draft' && (
                  <button onClick={() => selectIdea(idea.id)} className="btn btn-primary btn-full">
                    Select This Idea
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {ideas.length === 0 && !generating && (
          <div className="empty-state">
            <h2>No ideas yet</h2>
            <p>Generate AI-powered telenovela concepts or add your own</p>
          </div>
        )}

        {generating && (
          <div className="generating-state">
            <div className="spinner large"></div>
            <h2>Generating Ideas...</h2>
            <p>Creating dramatic telenovela concepts with AI</p>
          </div>
        )}

        {selectedIdea && (
          <div className="next-step-bar">
            <div className="selected-info">
              <span>Selected:</span>
              <strong>{selectedIdea.title}</strong>
            </div>
            <div className="episode-count-selector">
              <label htmlFor="num-episodes">Episodes:</label>
              <input id="num-episodes" type="range" min={5} max={25} value={numEpisodes} onChange={(e) => setNumEpisodes(Number(e.target.value))} />
              <span className="episode-count-value">{numEpisodes}</span>
              <span className={`episode-count-hint ${numEpisodes >= 20 && numEpisodes <= 24 ? 'recommended' : ''}`}>
                {numEpisodes >= 20 && numEpisodes <= 24 ? '(Recommended)' : '(Recommended: 20-24)'}
              </span>
            </div>
            <button onClick={proceedToStructure} className="btn btn-primary btn-large">
              Continue to Structure
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
