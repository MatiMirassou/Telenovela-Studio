import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';

export default function StructurePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [locations, setLocations] = useState([]);
  const [episodeSummaries, setEpisodeSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('characters');
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [projectData, chars, locs, eps] = await Promise.all([
        api.getProject(id),
        api.getCharacters(id),
        api.getLocations(id),
        api.getEpisodeSummaries(id)
      ]);
      setProject(projectData);
      setCharacters(chars);
      setLocations(locs);
      setEpisodeSummaries(eps);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateStructure = async () => {
    setGenerating(true);
    try {
      await api.generateStructure(id);
      await loadData();
    } catch (err) {
      console.error('Failed to generate structure:', err);
      alert('Failed to generate structure: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const approveAll = async () => {
    try {
      await api.approveAllStructure(id);
      await loadData();
    } catch (err) {
      console.error('Failed to approve all:', err);
      alert('Failed to approve all');
    }
  };

  const approveCharacter = async (charId) => {
    try {
      await api.approveCharacter(charId);
      setCharacters(characters.map(c => c.id === charId ? {...c, state: 'approved'} : c));
    } catch (err) {
      console.error('Failed to approve character:', err);
    }
  };

  const approveLocation = async (locId) => {
    try {
      await api.approveLocation(locId);
      setLocations(locations.map(l => l.id === locId ? {...l, state: 'approved'} : l));
    } catch (err) {
      console.error('Failed to approve location:', err);
    }
  };

  const approveEpisodeSummary = async (epId) => {
    try {
      await api.approveEpisodeSummary(epId);
      setEpisodeSummaries(episodeSummaries.map(e => e.id === epId ? {...e, state: 'approved'} : e));
    } catch (err) {
      console.error('Failed to approve episode summary:', err);
    }
  };

  const unapproveCharacter = async (charId) => {
    try {
      await api.unapproveCharacter(charId);
      setCharacters(characters.map(c => c.id === charId ? {...c, state: 'modified'} : c));
    } catch (err) { alert('Unapprove failed: ' + err.message); }
  };

  const unapproveLocation = async (locId) => {
    try {
      await api.unapproveLocation(locId);
      setLocations(locations.map(l => l.id === locId ? {...l, state: 'modified'} : l));
    } catch (err) { alert('Unapprove failed: ' + err.message); }
  };

  const unapproveEpisodeSummary = async (epId) => {
    try {
      await api.unapproveEpisodeSummary(epId);
      setEpisodeSummaries(episodeSummaries.map(e => e.id === epId ? {...e, state: 'modified'} : e));
    } catch (err) { alert('Unapprove failed: ' + err.message); }
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    
    try {
      if (editingItem.type === 'character') {
        await api.updateCharacter(editingItem.id, editingItem.data);
        setCharacters(characters.map(c => c.id === editingItem.id ? {...c, ...editingItem.data} : c));
      } else if (editingItem.type === 'location') {
        await api.updateLocation(editingItem.id, editingItem.data);
        setLocations(locations.map(l => l.id === editingItem.id ? {...l, ...editingItem.data} : l));
      } else if (editingItem.type === 'episode') {
        await api.updateEpisodeSummary(editingItem.id, editingItem.data);
        setEpisodeSummaries(episodeSummaries.map(e => e.id === editingItem.id ? {...e, ...editingItem.data} : e));
      }
      setEditingItem(null);
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Failed to save changes');
    }
  };

  const allApproved = 
    characters.length > 0 && characters.every(c => c.state === 'approved') &&
    locations.length > 0 && locations.every(l => l.state === 'approved') &&
    episodeSummaries.length > 0 && episodeSummaries.every(e => e.state === 'approved');

  const hasStructure = characters.length > 0 || locations.length > 0 || episodeSummaries.length > 0;

  const proceedToScripts = () => {
    navigate(`/projects/${id}/episodes`);
  };

  if (loading) {
    return (
      <Layout project={project}>
        <div className="loading-page">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout project={project}>
      <div className="page structure-page">
        <div className="page-header">
          <h1>Step 3-4: Structure</h1>
          <p>Define characters, locations, and episode arc</p>
        </div>

        {/* Generation Controls */}
        {!hasStructure && !generating && (
          <div className="generation-controls">
            <button 
              onClick={generateStructure} 
              className="btn btn-primary btn-large"
            >
              Generate Structure
            </button>
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
            {/* Tabs */}
            <div className="tabs">
              <button 
                className={`tab ${activeTab === 'characters' ? 'active' : ''}`}
                onClick={() => setActiveTab('characters')}
              >
                Characters ({characters.length})
                {characters.every(c => c.state === 'approved') && <span className="check">✓</span>}
              </button>
              <button 
                className={`tab ${activeTab === 'locations' ? 'active' : ''}`}
                onClick={() => setActiveTab('locations')}
              >
                Locations ({locations.length})
                {locations.every(l => l.state === 'approved') && <span className="check">✓</span>}
              </button>
              <button 
                className={`tab ${activeTab === 'episodes' ? 'active' : ''}`}
                onClick={() => setActiveTab('episodes')}
              >
                Episode Arc ({episodeSummaries.length})
                {episodeSummaries.every(e => e.state === 'approved') && <span className="check">✓</span>}
              </button>
            </div>

            {/* Action Bar */}
            <div className="action-bar">
              <button onClick={generateStructure} className="btn btn-secondary" disabled={generating}>
                Regenerate All
              </button>
              {!allApproved && (
                <button onClick={approveAll} className="btn btn-primary">
                  Approve All
                </button>
              )}
            </div>

            {/* Characters Tab */}
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
                        <div className="form-group">
                          <label>Name</label>
                          <input
                            value={editingItem.data.name || ''}
                            onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, name: e.target.value}})}
                          />
                        </div>
                        <div className="form-group">
                          <label>Physical Description</label>
                          <textarea
                            value={editingItem.data.physical_description || ''}
                            onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, physical_description: e.target.value}})}
                          />
                        </div>
                        <div className="form-group">
                          <label>Personality</label>
                          <textarea
                            value={editingItem.data.personality || ''}
                            onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, personality: e.target.value}})}
                          />
                        </div>
                        <div className="form-group">
                          <label>Secret</label>
                          <textarea
                            value={editingItem.data.secret || ''}
                            onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, secret: e.target.value}})}
                          />
                        </div>
                        <div className="button-row">
                          <button onClick={saveEdit} className="btn btn-primary">Save</button>
                          <button onClick={() => setEditingItem(null)} className="btn btn-secondary">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="item-meta">
                          <span>{char.archetype}</span>
                          <span>{char.age}</span>
                        </div>
                        <div className="item-field">
                          <label>Appearance</label>
                          <p>{char.physical_description}</p>
                        </div>
                        <div className="item-field">
                          <label>Personality</label>
                          <p>{char.personality}</p>
                        </div>
                        <div className="item-field">
                          <label>Secret</label>
                          <p>{char.secret}</p>
                        </div>
                        <div className="item-actions">
                          <button 
                            onClick={() => setEditingItem({type: 'character', id: char.id, data: {...char}})}
                            className="btn btn-small"
                          >
                            Edit
                          </button>
                          {char.state !== 'approved' ? (
                            <button
                              onClick={() => approveCharacter(char.id)}
                              className="btn btn-small btn-primary"
                            >
                              Approve
                            </button>
                          ) : (
                            <button
                              onClick={() => unapproveCharacter(char.id)}
                              className="btn btn-small btn-outline"
                            >
                              Unapprove
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Locations Tab */}
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
                        <div className="form-group">
                          <label>Name</label>
                          <input
                            value={editingItem.data.name || ''}
                            onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, name: e.target.value}})}
                          />
                        </div>
                        <div className="form-group">
                          <label>Description</label>
                          <textarea
                            value={editingItem.data.description || ''}
                            onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, description: e.target.value}})}
                          />
                        </div>
                        <div className="form-group">
                          <label>Visual Details</label>
                          <textarea
                            value={editingItem.data.visual_details || ''}
                            onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, visual_details: e.target.value}})}
                          />
                        </div>
                        <div className="button-row">
                          <button onClick={saveEdit} className="btn btn-primary">Save</button>
                          <button onClick={() => setEditingItem(null)} className="btn btn-secondary">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="item-field">
                          <label>Description</label>
                          <p>{loc.description}</p>
                        </div>
                        <div className="item-field">
                          <label>Mood</label>
                          <p>{loc.mood}</p>
                        </div>
                        <div className="item-field">
                          <label>Visual Details</label>
                          <p>{loc.visual_details}</p>
                        </div>
                        <div className="item-actions">
                          <button 
                            onClick={() => setEditingItem({type: 'location', id: loc.id, data: {...loc}})}
                            className="btn btn-small"
                          >
                            Edit
                          </button>
                          {loc.state !== 'approved' ? (
                            <button
                              onClick={() => approveLocation(loc.id)}
                              className="btn btn-small btn-primary"
                            >
                              Approve
                            </button>
                          ) : (
                            <button
                              onClick={() => unapproveLocation(loc.id)}
                              className="btn btn-small btn-outline"
                            >
                              Unapprove
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Episode Summaries Tab */}
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
                        <div className="form-group">
                          <label>Title</label>
                          <input
                            value={editingItem.data.title || ''}
                            onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, title: e.target.value}})}
                          />
                        </div>
                        <div className="form-group">
                          <label>Summary</label>
                          <textarea
                            value={editingItem.data.summary || ''}
                            onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, summary: e.target.value}})}
                          />
                        </div>
                        <div className="form-group">
                          <label>Cliffhanger</label>
                          <textarea
                            value={editingItem.data.cliffhanger || ''}
                            onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, cliffhanger: e.target.value}})}
                          />
                        </div>
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
                              <ul>
                                {(ep.key_beats || []).map((beat, i) => (
                                  <li key={i}>{beat}</li>
                                ))}
                              </ul>
                            </div>
                            <div className="detail cliffhanger">
                              <label>Cliffhanger</label>
                              <p>{ep.cliffhanger}</p>
                            </div>
                          </div>
                        </div>
                        <div className="item-actions">
                          <button 
                            onClick={() => setEditingItem({type: 'episode', id: ep.id, data: {...ep}})}
                            className="btn btn-small"
                          >
                            Edit
                          </button>
                          {ep.state !== 'approved' ? (
                            <button
                              onClick={() => approveEpisodeSummary(ep.id)}
                              className="btn btn-small btn-primary"
                            >
                              Approve
                            </button>
                          ) : (
                            <button
                              onClick={() => unapproveEpisodeSummary(ep.id)}
                              className="btn btn-small btn-outline"
                            >
                              Unapprove
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Next Step */}
        {allApproved && (
          <div className="next-step-bar">
            <div className="selected-info">
              <span>✓ All structure approved</span>
            </div>
            <button onClick={proceedToScripts} className="btn btn-primary btn-large">
              Generate Episode Scripts →
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
