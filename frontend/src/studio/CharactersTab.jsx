import { useState, useEffect } from 'react';
import api from '../api/client';

export default function CharactersTab({ projectId }) {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => { loadData(); }, [projectId]);

  const loadData = async () => {
    try {
      const chars = await api.getCharacters(projectId);
      setCharacters(chars);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const approveCharacter = async (charId) => {
    try {
      await api.approveCharacter(charId);
      setCharacters(characters.map(c => c.id === charId ? { ...c, state: 'approved' } : c));
    } catch (err) { console.error(err); }
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    try {
      await api.updateCharacter(editingItem.id, editingItem.data);
      setCharacters(characters.map(c => c.id === editingItem.id ? { ...c, ...editingItem.data } : c));
      setEditingItem(null);
    } catch (err) {
      alert('Failed to save changes');
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

  return (
    <div className="tab-content">
      <div className="page-header">
        <h2>Characters</h2>
        <p>{characters.length} characters defined</p>
      </div>

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
    </div>
  );
}
