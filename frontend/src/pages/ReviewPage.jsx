import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';

export default function ReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [review, setReview] = useState({ pending: [], approved: [], rejected: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const [proj, reviewData] = await Promise.all([
        api.getProject(id),
        api.getImagesForReview(id)
      ]);
      setProject(proj);
      setReview(reviewData);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const approveImage = async (img) => {
    try {
      if (img.type === 'scene_image') await api.approveImage(img.id);
      else if (img.type === 'character_ref') await api.approveCharacterRef(img.id);
      else if (img.type === 'location_ref') await api.approveLocationRef(img.id);
      else if (img.type === 'thumbnail') await api.approveThumbnail(img.id);
      await loadData();
    } catch (err) { alert('Failed'); }
  };

  const rejectImage = async (img) => {
    try {
      if (img.type === 'scene_image') await api.rejectImage(img.id);
      else if (img.type === 'character_ref') await api.rejectCharacterRef(img.id);
      else if (img.type === 'location_ref') await api.rejectLocationRef(img.id);
      else if (img.type === 'thumbnail') await api.rejectThumbnail(img.id);
      await loadData();
    } catch (err) { alert('Failed'); }
  };

  if (loading) return <Layout project={project}><div className="loading-page"><div className="spinner"></div></div></Layout>;

  return (
    <Layout project={project}>
      <div className="page">
        <div className="page-header">
          <h1>Step 10: Review Images</h1>
          <p>Approve or reject generated images</p>
        </div>

        <div className="review-stats">
          <span className="stat pending">{review.total_pending} pending</span>
          <span className="stat approved">{review.total_approved} approved</span>
          <span className="stat rejected">{review.total_rejected} rejected</span>
        </div>

        <h2>Pending Review</h2>
        {review.pending.length === 0 ? (
          <p className="empty">No images pending review</p>
        ) : (
          <div className="review-grid">
            {review.pending.map(img => (
              <div key={img.id} className="review-card card">
                <span className="type-badge">{img.type}</span>
                {img.image_path && (
                  <img src={`http://localhost:8000/outputs/${img.image_path}`} alt="" />
                )}
                <p>{img.description || img.name || `Ep ${img.episode_number}`}</p>
                <div className="review-actions">
                  <button onClick={() => approveImage(img)} className="btn btn-success">✓ Approve</button>
                  <button onClick={() => rejectImage(img)} className="btn btn-danger">✗ Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <h2>Approved ({review.approved.length})</h2>
        <div className="review-grid approved">
          {review.approved.map(img => (
            <div key={img.id} className="review-card card small">
              {img.image_path && <img src={`http://localhost:8000/outputs/${img.image_path}`} alt="" />}
            </div>
          ))}
        </div>

        <div className="next-step-bar">
          <button onClick={() => navigate(`/projects/${id}/video-prompts`)} className="btn btn-primary btn-large">
            Generate Video Prompts →
          </button>
        </div>
      </div>
    </Layout>
  );
}
