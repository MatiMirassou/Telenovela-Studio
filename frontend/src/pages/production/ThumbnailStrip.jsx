import { API_BASE } from '../../api/client';

export default function ThumbnailStrip({ thumbnails, onApprove, onReject, onRegenerate, disabled, cacheBust }) {
  if (!thumbnails || thumbnails.length === 0) return null;

  return (
    <div className="thumbnail-strip">
      <h4>Thumbnails</h4>
      <div className="thumbnail-strip-items">
        {thumbnails.map((thumb) => (
          <div key={thumb.id} className="thumbnail-item">
            <span className={`badge ${thumb.state}`}>{thumb.state}</span>
            {thumb.image_path ? (
              <img src={`${API_BASE}/outputs/${thumb.image_path}?t=${cacheBust || ''}`} alt="" />
            ) : (
              <div className="scene-media-placeholder" style={{ height: 80, width: 120 }}>
                {thumb.state === 'generating' ? 'Generating...' : 'Pending'}
              </div>
            )}
            <div className="orientation">{thumb.orientation}</div>
            <div className="media-actions" style={{ justifyContent: 'center', marginTop: '0.25rem' }}>
              {thumb.state === 'generated' && (
                <>
                  <button onClick={() => onApprove(thumb.id)} disabled={disabled} className="btn btn-success">Approve</button>
                  <button onClick={() => onReject(thumb.id)} disabled={disabled} className="btn btn-danger">Reject</button>
                </>
              )}
              {(thumb.state === 'approved' || thumb.state === 'rejected') && (
                <button onClick={() => onRegenerate(thumb.id)} disabled={disabled} className="btn btn-secondary">Regen</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
