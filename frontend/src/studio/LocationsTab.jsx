import { useState, useEffect } from 'react';
import api from '../api/client';

export default function LocationsTab({ projectId }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => { loadData(); }, [projectId]);

  const loadData = async () => {
    try {
      const locs = await api.getLocations(projectId);
      setLocations(locs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const approveLocation = async (locId) => {
    try {
      await api.approveLocation(locId);
      setLocations(locations.map(l => l.id === locId ? { ...l, state: 'approved' } : l));
    } catch (err) { console.error(err); }
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    try {
      await api.updateLocation(editingItem.id, editingItem.data);
      setLocations(locations.map(l => l.id === editingItem.id ? { ...l, ...editingItem.data } : l));
      setEditingItem(null);
    } catch (err) {
      alert('Failed to save changes');
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

  return (
    <div className="tab-content">
      <div className="page-header">
        <h2>Locations</h2>
        <p>{locations.length} locations defined</p>
      </div>

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
    </div>
  );
}
