import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';

export default function SetupPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Shared state
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('ideas'); // 'ideas' | 'structure'

  // Ideas state
  const [ideas, setIdeas] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [settingHint, setSettingHint] = useState('');
  const [numEpisodes, setNumEpisodes] = useState(20);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customIdea, setCustomIdea] = useState({ title: '', setting: '', logline: '', hook: '', main_conflict: '' });

  // Structure state
  const [characters, setCharacters] = useState([]);
  const [locations, setLocations] = useState([]);
  const [episodeSummaries, setEpisodeSummaries] = useState([]);
  const [activeTab, setActiveTab] = useState('characters');
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const [proj, ideasData] = await Promise.all([
        api.getProject(id),
        api.getIdeas(id)
      ]);
      setProject(proj);
      setIdeas(ideasData);
      if (proj?.num_episodes) setNumEpisodes(proj.num_episodes);

      const selectedIdea = ideasData.find(i => i.state === 'approved');
      if (selectedIdea) {
        // Load structure data
        const [chars, locs, eps] = await Promise.all([
          api.getCharacters(id),
          api.getLocations(id),
          api.getEpisodeSummaries(id)
        ]);
        setCharacters(chars);
        setLocations(locs);
        setEpisodeSummaries(eps);

        if (chars.length > 0 || locs.length > 0 || eps.length > 0) {
          setPhase('structure');
          // If all approved, redirect to studio
          const allApproved =
            chars.length > 0 && chars.every(c => c.state === 'approved') &&
            locs.length > 0 && locs.every(l => l.state === 'approved') &&
            eps.length > 0 && eps.every(e => e.state === 'approved');
          if (allApproved) {
            navigate(`/projects/${id}/studio`, { replace: true });
            return;
          }
        } else {
          setPhase('structure');
        }
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Ideas actions ──
  const generateIdeas = async () => {
    setGenerating(true);
    try {
      const newIdeas = await api.generateIdeas(id, settingHint || null);
      setIdeas(newIdeas);
      const proj = await api.getProject(id);
      setProject(proj);
    } catch (err) {
      alert('Failed to generate ideas: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const selectIdea = async (ideaId) => {
    try {
      await api.approveIdea(ideaId);
      await loadData();
    } catch (err) {
      alert('Failed to select idea');
    }
  };

  const addCustomIdea = async () => {
    try {
      const newIdea = await api.addCustomIdea(id, customIdea);
      setIdeas([...ideas, newIdea]);
      setShowCustomForm(false);
      setCustomIdea({ title: '', setting: '', logline: '', hook: '', main_conflict: '' });
    } catch (err) {
      alert('Failed to add custom idea');
    }
  };

  const proceedToStructure = async () => {
    try {
      await api.updateProject(id, { num_episodes: numEpisodes });
      setPhase('structure');
    } catch (err) {
      alert('Failed to update episode count: ' + err.message);
    }
  };

  // ── Structure actions ──
  const generateStructure = async () => {
    setGenerating(true);
    try {
      await api.generateStructure(id);
      const [chars, locs, eps] = await Promise.all([
        api.getCharacters(id),
        api.getLocations(id),
        api.getEpisodeSummaries(id)
      ]);
      setCharacters(chars);
      setLocations(locs);
      setEpisodeSummaries(eps);
    } catch (err) {
      alert('Failed to generate structure: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const approveAll = async () => {
    try {
      await api.approveAllStructure(id);
      const [chars, locs, eps] = await Promise.all([
        api.getCharacters(id),
        api.getLocations(id),
        api.getEpisodeSummaries(id)
      ]);
      setCharacters(chars);
      setLocations(locs);
      setEpisodeSummaries(eps);
    } catch (err) {
      alert('Failed to approve all');
    }
  };

  const approveCharacter = async (charId) => {
    try {
      await api.approveCharacter(charId);
      setCharacters(characters.map(c => c.id === charId ? { ...c, state: 'approved' } : c));
    } catch (err) { console.error(err); }
  };

  const approveLocation = async (locId) => {
    try {
      await api.approveLocation(locId);
      setLocations(locations.map(l => l.id === locId ? { ...l, state: 'approved' } : l));
    } catch (err) { console.error(err); }
  };

  const approveEpisodeSummary = async (epId) => {
    try {
      await api.approveEpisodeSummary(epId);
      setEpisodeSummaries(episodeSummaries.map(e => e.id === epId ? { ...e, state: 'approved' } : e));
    } catch (err) { console.error(err); }
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    try {
      if (editingItem.type === 'character') {
        await api.updateCharacter(editingItem.id, editingItem.data);
        setCharacters(characters.map(c => c.id === editingItem.id ? { ...c, ...editingItem.data } : c));
      } else if (editingItem.type === 'location') {
        await api.updateLocation(editingItem.id, editingItem.data);
        setLocations(locations.map(l => l.id === editingItem.id ? { ...l, ...editingItem.data } : l));
      } else if (editingItem.type === 'episode') {
        await api.updateEpisodeSummary(editingItem.id, editingItem.data);
        setEpisodeSummaries(episodeSummaries.map(e => e.id === editingItem.id ? { ...e, ...editingItem.data } : e));
      }
      setEditingItem(null);
    } catch (err) {
      alert('Failed to save changes');
    }
  };

  const selectedIdea = ideas.find(i => i.state === 'approved');
  const hasStructure = characters.length > 0 || locations.length > 0 || episodeSummaries.length > 0;
  const allApproved =
    characters.length > 0 && characters.every(c => c.state === 'approved') &&
    locations.length > 0 && locations.every(l => l.state === 'approved') &&
    episodeSummaries.length > 0 && episodeSummaries.every(e => e.state === 'approved');

  if (loading) {
    return (
      <Layout project={project}>
        <div className="loading-page"><div className="spinner"></div><p>Loading...</p></div>
      </Layout>
    );
  }

  return (
    <Layout project={project}>
      <div className="page setup-page">
        {/* ── Phase 1: Ideas ── */}
        {phase === 'ideas' && (
          <>
            <div className="page-header">
              <h1 className="gradient-title">Choose Your Story</h1>
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
                  <button onClick={generateIdeas} disabled={generating} className="btn btn-primary">
                    {generating ? 'Generating...' : ideas.length ? 'Regenerate Ideas' : 'Generate Ideas'}
                  </button>
                </div>
                <button onClick={() => setShowCustomForm(!showCustomForm)} className="btn btn-secondary">
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
                    <input value={customIdea.title} onChange={(e) => setCustomIdea({ ...customIdea, title: e.target.value })} placeholder="Clickbait-worthy title" />
                  </div>
                  <div className="form-group">
                    <label>Setting</label>
                    <input value={customIdea.setting} onChange={(e) => setCustomIdea({ ...customIdea, setting: e.target.value })} placeholder="Where does it take place?" />
                  </div>
                  <div className="form-group full-width">
                    <label>Logline</label>
                    <textarea value={customIdea.logline} onChange={(e) => setCustomIdea({ ...customIdea, logline: e.target.value })} placeholder="One-sentence premise" />
                  </div>
                  <div className="form-group full-width">
                    <label>Hook</label>
                    <textarea value={customIdea.hook} onChange={(e) => setCustomIdea({ ...customIdea, hook: e.target.value })} placeholder="The twist that hooks viewers" />
                  </div>
                  <div className="form-group full-width">
                    <label>Main Conflict</label>
                    <textarea value={customIdea.main_conflict} onChange={(e) => setCustomIdea({ ...customIdea, main_conflict: e.target.value })} placeholder="Central dramatic tension" />
                  </div>
                </div>
                <button onClick={addCustomIdea} className="btn btn-primary">Add Idea</button>
              </div>
            )}

            {generating && (
              <div className="generating-state">
                <div className="spinner large"></div>
                <h2>Generating Ideas...</h2>
                <p>Creating dramatic telenovela concepts with AI</p>
              </div>
            )}

            {ideas.length > 0 && !generating && (
              <div className="ideas-grid">
                {ideas.map((idea) => (
                  <div key={idea.id} className={`idea-card card ${idea.state === 'approved' ? 'selected' : ''} ${idea.state === 'rejected' ? 'rejected' : ''}`}>
                    <div className="idea-header">
                      <h3>{idea.title}</h3>
                      {idea.state === 'approved' && <span className="badge badge-success">Selected</span>}
                    </div>
                    <div className="idea-field"><label>Setting</label><p>{idea.setting}</p></div>
                    <div className="idea-field"><label>Logline</label><p>{idea.logline}</p></div>
                    <div className="idea-field"><label>Hook</label><p>{idea.hook}</p></div>
                    <div className="idea-field"><label>Main Conflict</label><p>{idea.main_conflict}</p></div>
                    {idea.state === 'draft' && (
                      <button onClick={() => selectIdea(idea.id)} className="btn btn-primary btn-full">Select This Idea</button>
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
                </div>
                <button onClick={proceedToStructure} className="btn btn-primary btn-large">
                  Continue to Structure
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Phase 2: Structure ── */}
        {phase === 'structure' && (
          <>
            <div className="page-header">
              <h1 className="gradient-title">Build Your World</h1>
              <p>Define characters, locations, and episode arc</p>
            </div>

            {!hasStructure && !generating && (
              <div className="generation-controls">
                <button onClick={generateStructure} className="btn btn-primary btn-large">Generate Structure</button>
                <p className="hint">This will create characters, locations, and episode summaries based on your selected idea</p>
              </div>
            )}

            {generating && (
              <div className="generating-state">
                <div className="spinner large"></div>
                <h2>Generating Structure...</h2>
                <p>Creating characters, locations, and episode arc</p>
              </div>
            )}

            {hasStructure && (
              <>
                <div className="tabs">
                  <button className={`tab ${activeTab === 'characters' ? 'active' : ''}`} onClick={() => setActiveTab('characters')}>
                    Characters ({characters.length})
                    {characters.length > 0 && characters.every(c => c.state === 'approved') && <span className="check"> ✓</span>}
                  </button>
                  <button className={`tab ${activeTab === 'locations' ? 'active' : ''}`} onClick={() => setActiveTab('locations')}>
                    Locations ({locations.length})
                    {locations.length > 0 && locations.every(l => l.state === 'approved') && <span className="check"> ✓</span>}
                  </button>
                  <button className={`tab ${activeTab === 'episodes' ? 'active' : ''}`} onClick={() => setActiveTab('episodes')}>
                    Episode Arc ({episodeSummaries.length})
                    {episodeSummaries.length > 0 && episodeSummaries.every(e => e.state === 'approved') && <span className="check"> ✓</span>}
                  </button>
                </div>

                <div className="action-bar">
                  <button onClick={generateStructure} className="btn btn-secondary" disabled={generating}>Regenerate All</button>
                  {!allApproved && <button onClick={approveAll} className="btn btn-primary">Approve All</button>}
                </div>

                {/* Characters */}
                {activeTab === 'characters' && (
                  <div className="items-grid">
                    {characters.map((char) => (
                      <div key={char.id} className={`item-card card ${char.state === 'approved' ? 'approved' : ''}`}>
                        <div className="item-header">
                          <h3>{char.name}</h3>
                          <span className={`badge badge-${char.role}`}>{char.role}</span>
                          {char.state === 'approved' && <span className="badge badge-success">✓</span>}
                        </div>
                        {editingItem?.id === char.id ? (
                          <div className="edit-form">
                            <div className="form-group"><label>Name</label><input value={editingItem.data.name || ''} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })} /></div>
                            <div className="form-group"><label>Physical Description</label><textarea value={editingItem.data.physical_description || ''} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, physical_description: e.target.value } })} /></div>
                            <div className="form-group"><label>Personality</label><textarea value={editingItem.data.personality || ''} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, personality: e.target.value } })} /></div>
                            <div className="form-group"><label>Secret</label><textarea value={editingItem.data.secret || ''} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, secret: e.target.value } })} /></div>
                            <div className="button-row">
                              <button onClick={saveEdit} className="btn btn-primary">Save</button>
                              <button onClick={() => setEditingItem(null)} className="btn btn-secondary">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="item-meta"><span>{char.archetype}</span><span>{char.age}</span></div>
                            <div className="item-field"><label>Appearance</label><p>{char.physical_description}</p></div>
                            <div className="item-field"><label>Personality</label><p>{char.personality}</p></div>
                            <div className="item-field"><label>Secret</label><p>{char.secret}</p></div>
                            <div className="item-actions">
                              <button onClick={() => setEditingItem({ type: 'character', id: char.id, data: { ...char } })} className="btn btn-small">Edit</button>
                              {char.state !== 'approved' && <button onClick={() => approveCharacter(char.id)} className="btn btn-small btn-primary">Approve</button>}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Locations */}
                {activeTab === 'locations' && (
                  <div className="items-grid">
                    {locations.map((loc) => (
                      <div key={loc.id} className={`item-card card ${loc.state === 'approved' ? 'approved' : ''}`}>
                        <div className="item-header">
                          <h3>{loc.name}</h3>
                          <span className="badge">{loc.type}</span>
                          {loc.state === 'approved' && <span className="badge badge-success">✓</span>}
                        </div>
                        {editingItem?.id === loc.id ? (
                          <div className="edit-form">
                            <div className="form-group"><label>Name</label><input value={editingItem.data.name || ''} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })} /></div>
                            <div className="form-group"><label>Description</label><textarea value={editingItem.data.description || ''} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, description: e.target.value } })} /></div>
                            <div className="form-group"><label>Visual Details</label><textarea value={editingItem.data.visual_details || ''} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, visual_details: e.target.value } })} /></div>
                            <div className="button-row">
                              <button onClick={saveEdit} className="btn btn-primary">Save</button>
                              <button onClick={() => setEditingItem(null)} className="btn btn-secondary">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="item-field"><label>Description</label><p>{loc.description}</p></div>
                            <div className="item-field"><label>Mood</label><p>{loc.mood}</p></div>
                            <div className="item-field"><label>Visual Details</label><p>{loc.visual_details}</p></div>
                            <div className="item-actions">
                              <button onClick={() => setEditingItem({ type: 'location', id: loc.id, data: { ...loc } })} className="btn btn-small">Edit</button>
                              {loc.state !== 'approved' && <button onClick={() => approveLocation(loc.id)} className="btn btn-small btn-primary">Approve</button>}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Episode Summaries */}
                {activeTab === 'episodes' && (
                  <div className="episodes-list">
                    {episodeSummaries.map((ep) => (
                      <div key={ep.id} className={`episode-summary-card card ${ep.state === 'approved' ? 'approved' : ''}`}>
                        <div className="episode-header">
                          <span className="episode-number">Episode {ep.episode_number}</span>
                          <h3>{ep.title}</h3>
                          {ep.state === 'approved' && <span className="badge badge-success">✓</span>}
                        </div>
                        {editingItem?.id === ep.id ? (
                          <div className="edit-form">
                            <div className="form-group"><label>Title</label><input value={editingItem.data.title || ''} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, title: e.target.value } })} /></div>
                            <div className="form-group"><label>Summary</label><textarea value={editingItem.data.summary || ''} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, summary: e.target.value } })} /></div>
                            <div className="form-group"><label>Cliffhanger</label><textarea value={editingItem.data.cliffhanger || ''} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, cliffhanger: e.target.value } })} /></div>
                            <div className="button-row">
                              <button onClick={saveEdit} className="btn btn-primary">Save</button>
                              <button onClick={() => setEditingItem(null)} className="btn btn-secondary">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="episode-content">
                              <p className="summary">{ep.summary}</p>
                              <div className="episode-details">
                                <div className="detail">
                                  <label>Key Beats</label>
                                  <ul>{(ep.key_beats || []).map((beat, i) => <li key={i}>{beat}</li>)}</ul>
                                </div>
                                <div className="detail cliffhanger">
                                  <label>Cliffhanger</label>
                                  <p>{ep.cliffhanger}</p>
                                </div>
                              </div>
                            </div>
                            <div className="item-actions">
                              <button onClick={() => setEditingItem({ type: 'episode', id: ep.id, data: { ...ep } })} className="btn btn-small">Edit</button>
                              {ep.state !== 'approved' && <button onClick={() => approveEpisodeSummary(ep.id)} className="btn btn-small btn-primary">Approve</button>}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {allApproved && (
              <div className="next-step-bar">
                <span>All structure approved</span>
                <button onClick={() => navigate(`/projects/${id}/studio`)} className="btn btn-primary btn-large">
                  Open Studio
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
