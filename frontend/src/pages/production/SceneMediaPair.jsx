import { API_BASE } from '../../api/client';

export default function SceneMediaPair({ type, prompt, media, onApprove, onReject, onRegenerate, disabled }) {
  const isImage = type === 'image';
  const label = isImage ? 'Image Prompt' : 'Video Prompt';
  const mediaLabel = isImage ? 'Generated Image' : 'Generated Video';

  return (
    <div className="scene-media-pair">
      {/* Left: prompt text */}
      <div className="scene-media-prompt">
        <div className="prompt-label">{label} #{prompt.shot_number || prompt.segment_number || '—'}</div>
        {prompt.state && <span className={`badge ${prompt.state}`} style={{ marginBottom: '0.25rem', display: 'inline-block' }}>{prompt.state}</span>}
        <div className="prompt-body">
          {prompt.prompt_text || prompt.description || '(no prompt text)'}
        </div>
        {prompt.shot_type && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Shot: {prompt.shot_type}</div>}
        {prompt.camera_movement && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Camera: {prompt.camera_movement}</div>}
      </div>

      {/* Right: generated media */}
      <div className="scene-media-output">
        {media ? (
          <>
            <span className={`badge ${media.state}`}>{media.state}</span>
            {isImage && media.image_path ? (
              <img src={`${API_BASE}/outputs/${media.image_path}`} alt="" />
            ) : !isImage && media.video_path ? (
              <video controls src={`${API_BASE}/outputs/${media.video_path}`} />
            ) : (
              <div className="scene-media-placeholder">{media.state === 'generating' ? 'Generating...' : 'Pending'}</div>
            )}
            <div className="media-actions">
              {media.state === 'generated' && (
                <>
                  <button onClick={() => onApprove(media.id)} disabled={disabled} className="btn btn-success">Approve</button>
                  <button onClick={() => onReject(media.id)} disabled={disabled} className="btn btn-danger">Reject</button>
                </>
              )}
              {(media.state === 'approved' || media.state === 'rejected' || media.state === 'generated') && (
                <button onClick={() => onRegenerate(media.id)} disabled={disabled} className="btn btn-secondary">Regen</button>
              )}
            </div>
          </>
        ) : (
          <div className="scene-media-placeholder">
            {mediaLabel} not generated
          </div>
        )}
      </div>
    </div>
  );
}
