import { useState, useEffect } from 'react';
import api from '../api/client';

export default function ReviewTab({ projectId }) {
  const [review, setReview] = useState({ pending: [], approved: [], rejected: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [projectId]);

  const loadData = async () => {
    try {
      const data = await api.getImagesForReview(projectId);
      setReview(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const approveImage = async (img) => {
    try {
      if (img.type === 'scene_image') await api.approveImage(img.id);
      else if (img.type === 'character_ref') await api.approveCharacterRef(img.id);
      else if (img.type === 'location_ref') await api.approveLocationRef(img.id);
      else if (img.type === 'thumbnail') await api.approveThumbnail(img.id);
      await loadData();
    } catch (err) { alert('Failed to approve'); }
  };

  const rejectImage = async (img) => {
    try {
      if (img.type === 'scene_image') await api.rejectImage(img.id);
      else if (img.type === 'character_ref') await api.rejectCharacterRef(img.id);
      else if (img.type === 'location_ref') await api.rejectLocationRef(img.id);
      else if (img.type === 'thumbnail') await api.rejectThumbnail(img.id);
      await loadData();
    } catch (err) { alert('Failed to reject'); }
  };

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

  return (
    <div className="tab-content">
      <div className="page-header">
        <h2>Review Images</h2>
        <p>Approve or reject generated images</p>
      </div>

      <div className="review-stats">
        <span className="stat pending">{review.total_pending || 0} pending</span>
        <span className="stat approved">{review.total_approved || 0} approved</span>
        <span className="stat rejected">{review.total_rejected || 0} rejected</span>
      </div>

      <h3>Pending Review</h3>
      {(review.pending || []).length === 0 ? (
        <p className="empty">No images pending review</p>
      ) : (
        <div className="review-grid">
          {review.pending.map(img => (
            <div key={img.id} className="review-card card">
              <span className="type-badge">{img.type}</span>
              {img.image_path && <img src={`http://localhost:8000/outputs/${img.image_path}`} alt="" />}
              <p>{img.description || img.name || `Ep ${img.episode_number}`}</p>
              <div className="review-actions">
                <button onClick={() => approveImage(img)} className="btn btn-success">Approve</button>
                <button onClick={() => rejectImage(img)} className="btn btn-danger">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3>Approved ({(review.approved || []).length})</h3>
      <div className="review-grid approved">
        {(review.approved || []).map(img => (
          <div key={img.id} className="review-card card small">
            {img.image_path && <img src={`http://localhost:8000/outputs/${img.image_path}`} alt="" />}
          </div>
        ))}
      </div>
    </div>
  );
}
