import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api, { API_BASE } from '../api/client';
import { showToast } from '../components/Toast';

export default function StructureTab() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [locations, setLocations] = useState([]);
  const [episodeSummaries, setEpisodeSummaries] = useState([]);
  const [charRefs, setCharRefs] = useState([]);
  const [locRefs, setLocRefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generatingRefs, setGeneratingRefs] = useState(false);
  const [generatingRefImages, setGeneratingRefImages] = useState(false);
  const [activeTab, setActiveTab] = useState('characters');
  const [editingItem, setEditingItem] = useState(null);
  const [pendingRefAction, setPendingRefAction] = useState(null); // tracks ref ID being acted on

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    setError(null);
    try {
      const [projectData, chars, locs, eps, cRefs, lRefs] = await Promise.all([
        api.getProject(id),
        api.getCharacters(id),
        api.getLocations(id),
        api.getEpisodeSummaries(id),
        api.getCharacterRefs(id),
        api.getLocationRefs(id),
      ]);
      setProject(projectData);
      setCharacters(chars);
      setLocations(locs);
      setEpisodeSummaries(eps);
      setCharRefs(cRefs);
      setLocRefs(lRefs);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const charRefMap = useMemo(() => Object.fromEntries(charRefs.map(r => [r.character_id, r])), [charRefs]);
  const locRefMap = useMemo(() => Object.fromEntries(locRefs.map(r => [r.location_id, r])), [locRefs]);
  const allRefs = useMemo(() => [...charRefs, ...locRefs], [charRefs, locRefs]);
  const refsWithImages = allRefs.filter(r => r.image_path).length;
  const totalExpectedRefs = characters.length + locations.length;

  const generateStructure = async () => {
    setGenerating(true);
    try {
      await api.generateStructure(id);
      await loadData();
    } catch (err) {
      showToast('Failed to generate structure: ' + err.message, 'error');
    } finally { setGenerating(false); }
  };

  const approveAll = async () => {
    try {
      await api.approveAllStructure(id);
      await loadData();
    } catch (err) { showToast('Failed to approve all: ' + err.message, 'error'); }
  };

  const generateReferences = async () => {
    if (characters.length === 0 && locations.length === 0) {
      showToast('Generate structure first before creating references.', 'error');
      return;
    }

    setGeneratingRefs(true);
    try {
      // Step 1: Create prompts for any chars/locs that don't have refs yet
      await api.generateReferences(id);

      // Step 2: Generate images for all pending/generating refs
      setGeneratingRefImages(true);
      const imgResult = await api.generateReferenceImages(id);
      await loadData();

      const errors = imgResult.errors || [];
      if (errors.length > 0) {
        const firstError = errors[0]?.error || 'Unknown error';
        showToast(`Image generation failed (${errors.length} errors). ${firstError}`, 'error');
      }
      // No alert on success — the images appearing on cards IS the feedback
    } catch (err) {
      showToast('Failed to generate references: ' + err.message, 'error');
    } finally {
      setGeneratingRefs(false);
      setGeneratingRefImages(false);
    }
  };

  const regenerateAllRefs = async () => {
    if (!confirm('This will regenerate ALL reference images. Continue?')) return;
    setGeneratingRefs(true);
    setGeneratingRefImages(true);
    try {
      // Regenerate each ref individually (uses the regenerate endpoint which handles any state)
      const promises = [];
      for (const ref of charRefs) {
        promises.push(api.regenerateCharacterRef(ref.id).catch(() => {}));
      }
      for (const ref of locRefs) {
        promises.push(api.regenerateLocationRef(ref.id).catch(() => {}));
      }
      await Promise.all(promises);
      await loadData();
    } catch (err) {
      showToast('Failed to regenerate: ' + err.message, 'error');
    } finally {
      setGeneratingRefs(false);
      setGeneratingRefImages(false);
    }
  };

  const approveCharacter = async (charId) => {
    try { await api.approveCharacter(charId); setCharacters(characters.map(c => c.id === charId ? {...c, state: 'approved'} : c)); }
    catch (err) { showToast('Approve failed: ' + err.message, 'error'); }
  };
  const unapproveCharacter = async (charId) => {
    try { await api.unapproveCharacter(charId); setCharacters(characters.map(c => c.id === charId ? {...c, state: 'modified'} : c)); }
    catch (err) { showToast('Unapprove failed: ' + err.message, 'error'); }
  };
  const approveLocation = async (locId) => {
    try { await api.approveLocation(locId); setLocations(locations.map(l => l.id === locId ? {...l, state: 'approved'} : l)); }
    catch (err) { showToast('Approve failed: ' + err.message, 'error'); }
  };
  const unapproveLocation = async (locId) => {
    try { await api.unapproveLocation(locId); setLocations(locations.map(l => l.id === locId ? {...l, state: 'modified'} : l)); }
    catch (err) { showToast('Unapprove failed: ' + err.message, 'error'); }
  };
  const approveEpisodeSummary = async (epId) => {
    try { await api.approveEpisodeSummary(epId); setEpisodeSummaries(episodeSummaries.map(e => e.id === epId ? {...e, state: 'approved'} : e)); }
    catch (err) { showToast('Approve failed: ' + err.message, 'error'); }
  };
  const unapproveEpisodeSummary = async (epId) => {
    try { await api.unapproveEpisodeSummary(epId); setEpisodeSummaries(episodeSummaries.map(e => e.id === epId ? {...e, state: 'modified'} : e)); }
    catch (err) { showToast('Unapprove failed: ' + err.message, 'error'); }
  };

  // Ref approve/reject/regenerate (with double-click guard)
  const refAction = async (refId, apiFn) => {
    if (pendingRefAction) return;
    setPendingRefAction(refId);
    try { await apiFn(); await loadData(); }
    catch (err) { showToast('Failed: ' + err.message, 'error'); }
    finally { setPendingRefAction(null); }
  };
  const approveCharRef = (refId) => refAction(refId, () => api.approveCharacterRef(refId));
  const rejectCharRef = (refId) => refAction(refId, () => api.rejectCharacterRef(refId));
  const regenerateCharRef = (refId) => refAction(refId, () => api.regenerateCharacterRef(refId));
  const approveLocRef = (refId) => refAction(refId, () => api.approveLocationRef(refId));
  const rejectLocRef = (refId) => refAction(refId, () => api.rejectLocationRef(refId));
  const regenerateLocRef = (refId) => refAction(refId, () => api.regenerateLocationRef(refId));

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
    } catch (err) { showToast('Failed to save changes', 'error'); }
  };

  const allApproved =
    characters.length > 0 && characters.every(c => c.state === 'approved') &&
    locations.length > 0 && locations.every(l => l.state === 'approved') &&
    episodeSummaries.length > 0 && episodeSummaries.every(e => e.state === 'approved');

  const hasStructure = characters.length > 0 || locations.length > 0 || episodeSummaries.length > 0;

  if (loading) {
    return <Layout project={project}><div className="loading-page"><div className="spinner"></div><p>Loading...</p></div></Layout>;
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
      <div className="page structure-page">
        <div className="page-header">
          <h1>Structure</h1>
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
            <p>Creating characters, locations, and episode arc. This may take a minute.</p>
          </div>
        )}

        {hasStructure && !generating && (
          <>
            {/* Tabs */}
            <div className="tabs">
              <button className={`tab ${activeTab === 'characters' ? 'active' : ''}`} onClick={() => setActiveTab('characters')}>
                Characters ({characters.length})
                {characters.every(c => c.state === 'approved') && <span className="check">✓</span>}
              </button>
              <button className={`tab ${activeTab === 'locations' ? 'active' : ''}`} onClick={() => setActiveTab('locations')}>
                Locations ({locations.length})
                {locations.every(l => l.state === 'approved') && <span className="check">✓</span>}
              </button>
              <button className={`tab ${activeTab === 'episodes' ? 'active' : ''}`} onClick={() => setActiveTab('episodes')}>
                Episode Arc ({episodeSummaries.length})
                {episodeSummaries.every(e => e.state === 'approved') && <span className="check">✓</span>}
              </button>
            </div>

            {/* Action Bar */}
            <div className="action-bar">
              <button onClick={generateStructure} className="btn btn-secondary" disabled={generating}>Regenerate Structure</button>
              {!allApproved && <button onClick={approveAll} className="btn btn-success">Approve All Structure</button>}
            </div>

            {/* Reference Generation — shown on characters/locations tabs */}
            {(activeTab === 'characters' || activeTab === 'locations') && (
              <div className="action-bar" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                {refsWithImages >= totalExpectedRefs && totalExpectedRefs > 0 ? (
                  <button onClick={regenerateAllRefs} disabled={generatingRefs || generatingRefImages} className="btn btn-secondary">
                    {generatingRefImages ? (
                      <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}></span> Regenerating...</>
                    ) : 'Regenerate All References'}
                  </button>
                ) : (
                  <button onClick={generateReferences} disabled={generatingRefs || generatingRefImages} className="btn btn-primary">
                    {generatingRefs && !generatingRefImages ? (
                      <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}></span> Creating Prompts...</>
                    ) : generatingRefImages ? (
                      <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}></span> Generating Images...</>
                    ) : 'Generate Reference Images'}
                  </button>
                )}
                {totalExpectedRefs > 0 && (
                  <span className="hint">
                    {refsWithImages}/{totalExpectedRefs} images generated
                  </span>
                )}
              </div>
            )}

            {/* Characters Tab */}
            {activeTab === 'characters' && (
              <div className="items-grid">
                {characters.map((char) => {
                  const ref = charRefMap[char.id];
                  return (
                    <div key={char.id} className={`item-card card ${char.state === 'approved' ? 'approved' : ''}`}>
                      {/* Reference image or placeholder */}
                      {ref?.image_path ? (
                        <>
                          <img src={`${API_BASE}${ref.image_path}`} alt={char.name} className="item-ref-image" />
                          <div className="ref-actions">
                            <span className={`badge ${ref.state}`}>{ref.state}</span>
                            {ref.state === 'generated' && <button onClick={() => approveCharRef(ref.id)} disabled={!!pendingRefAction} className="btn btn-small btn-success">Approve</button>}
                            {ref.state === 'generated' && <button onClick={() => rejectCharRef(ref.id)} disabled={!!pendingRefAction} className="btn btn-small btn-danger">Reject</button>}
                            <button onClick={() => regenerateCharRef(ref.id)} disabled={!!pendingRefAction} className="btn btn-small btn-secondary">Regenerate</button>
                          </div>
                        </>
                      ) : ref ? (
                        <div className="item-ref-placeholder">
                          <div style={{ textAlign: 'center' }}>
                            <span className={`badge ${ref.state}`}>{ref.state}</span>
                            {ref.state === 'generating' && (
                              <div style={{ marginTop: '0.5rem' }}>
                                <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2, display: 'inline-block' }}></span>
                                <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Generating image...</p>
                              </div>
                            )}
                            {(ref.state === 'pending' || ref.state === 'rejected') && (
                              <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Waiting for image generation</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="item-ref-placeholder">
                          <span style={{ fontSize: '0.8rem' }}>No reference yet</span>
                        </div>
                      )}

                      <div className="item-header">
                        <h3>{char.name}</h3>
                        <span className={`badge badge-${char.role}`}>{char.role}</span>
                        {char.state === 'approved' && <span className="badge badge-success">✓</span>}
                      </div>

                      {editingItem?.id === char.id ? (
                        <div className="edit-form">
                          <div className="form-group"><label>Name</label><input value={editingItem.data.name || ''} onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, name: e.target.value}})} /></div>
                          <div className="form-group"><label>Physical Description</label><textarea value={editingItem.data.physical_description || ''} onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, physical_description: e.target.value}})} /></div>
                          <div className="form-group"><label>Personality</label><textarea value={editingItem.data.personality || ''} onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, personality: e.target.value}})} /></div>
                          <div className="form-group"><label>Secret</label><textarea value={editingItem.data.secret || ''} onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, secret: e.target.value}})} /></div>
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
                            <button onClick={() => setEditingItem({type: 'character', id: char.id, data: {...char}})} className="btn btn-small">Edit</button>
                            {char.state !== 'approved' ? (
                              <button onClick={() => approveCharacter(char.id)} className="btn btn-small btn-primary">Approve</button>
                            ) : (
                              <button onClick={() => unapproveCharacter(char.id)} className="btn btn-small btn-outline">Unapprove</button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Locations Tab */}
            {activeTab === 'locations' && (
              <div className="items-grid">
                {locations.map((loc) => {
                  const ref = locRefMap[loc.id];
                  return (
                    <div key={loc.id} className={`item-card card ${loc.state === 'approved' ? 'approved' : ''}`}>
                      {/* Reference image or placeholder */}
                      {ref?.image_path ? (
                        <>
                          <img src={`${API_BASE}${ref.image_path}`} alt={loc.name} className="item-ref-image" />
                          <div className="ref-actions">
                            <span className={`badge ${ref.state}`}>{ref.state}</span>
                            {ref.state === 'generated' && <button onClick={() => approveLocRef(ref.id)} disabled={!!pendingRefAction} className="btn btn-small btn-success">Approve</button>}
                            {ref.state === 'generated' && <button onClick={() => rejectLocRef(ref.id)} disabled={!!pendingRefAction} className="btn btn-small btn-danger">Reject</button>}
                            <button onClick={() => regenerateLocRef(ref.id)} disabled={!!pendingRefAction} className="btn btn-small btn-secondary">Regenerate</button>
                          </div>
                        </>
                      ) : ref ? (
                        <div className="item-ref-placeholder">
                          <div style={{ textAlign: 'center' }}>
                            <span className={`badge ${ref.state}`}>{ref.state}</span>
                            {ref.state === 'generating' && (
                              <div style={{ marginTop: '0.5rem' }}>
                                <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2, display: 'inline-block' }}></span>
                                <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Generating image...</p>
                              </div>
                            )}
                            {(ref.state === 'pending' || ref.state === 'rejected') && (
                              <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Waiting for image generation</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="item-ref-placeholder">
                          <span style={{ fontSize: '0.8rem' }}>No reference yet</span>
                        </div>
                      )}

                      <div className="item-header">
                        <h3>{loc.name}</h3>
                        <span className="badge">{loc.type}</span>
                        {loc.state === 'approved' && <span className="badge badge-success">✓</span>}
                      </div>

                      {editingItem?.id === loc.id ? (
                        <div className="edit-form">
                          <div className="form-group"><label>Name</label><input value={editingItem.data.name || ''} onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, name: e.target.value}})} /></div>
                          <div className="form-group"><label>Description</label><textarea value={editingItem.data.description || ''} onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, description: e.target.value}})} /></div>
                          <div className="form-group"><label>Visual Details</label><textarea value={editingItem.data.visual_details || ''} onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, visual_details: e.target.value}})} /></div>
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
                            <button onClick={() => setEditingItem({type: 'location', id: loc.id, data: {...loc}})} className="btn btn-small">Edit</button>
                            {loc.state !== 'approved' ? (
                              <button onClick={() => approveLocation(loc.id)} className="btn btn-small btn-primary">Approve</button>
                            ) : (
                              <button onClick={() => unapproveLocation(loc.id)} className="btn btn-small btn-outline">Unapprove</button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
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
                        <div className="form-group"><label>Title</label><input value={editingItem.data.title || ''} onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, title: e.target.value}})} /></div>
                        <div className="form-group"><label>Summary</label><textarea value={editingItem.data.summary || ''} onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, summary: e.target.value}})} /></div>
                        <div className="form-group"><label>Cliffhanger</label><textarea value={editingItem.data.cliffhanger || ''} onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, cliffhanger: e.target.value}})} /></div>
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
                          <button onClick={() => setEditingItem({type: 'episode', id: ep.id, data: {...ep}})} className="btn btn-small">Edit</button>
                          {ep.state !== 'approved' ? (
                            <button onClick={() => approveEpisodeSummary(ep.id)} className="btn btn-small btn-primary">Approve</button>
                          ) : (
                            <button onClick={() => unapproveEpisodeSummary(ep.id)} className="btn btn-small btn-outline">Unapprove</button>
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

        {allApproved && (
          <div className="next-step-bar">
            <div className="selected-info"><span>All structure approved</span></div>
            <button onClick={() => navigate(`/projects/${id}/production`)} className="btn btn-primary btn-large">
              Continue to Production
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
