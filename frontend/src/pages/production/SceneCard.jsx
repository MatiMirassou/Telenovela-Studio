import SceneMediaPair from './SceneMediaPair';

export default function SceneCard({
  scene,
  imagePrompts,
  videoPrompts,
  onApproveImage,
  onRejectImage,
  onRegenerateImage,
  onApproveVideo,
  onRejectVideo,
  onRegenerateVideo,
  mediaActionDisabled,
  cacheBust,
}) {
  return (
    <div className="scene-card">
      <div className="scene-header">
        <span className="scene-number">Scene {scene.scene_number}</span>
        <h4>{scene.title}</h4>
        <span className="scene-duration">{scene.duration_seconds}s</span>
      </div>

      <div className="scene-meta">
        {scene.time_of_day && <span>{scene.time_of_day}</span>}
        {scene.mood && <span>{scene.mood}</span>}
      </div>

      {/* Dialogue */}
      {scene.dialogue_lines && scene.dialogue_lines.length > 0 && (
        <div className="dialogue-list">
          {scene.dialogue_lines.map((line) => (
            <div key={line.id} className="dialogue-line">
              <span className="character">{line.character_name}</span>
              {line.direction && <span className="direction">({line.direction})</span>}
              <p className="line-text">{line.line_text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Image Prompts + Generated Images */}
      {imagePrompts && imagePrompts.length > 0 && (
        <div className="scene-media-section">
          <h5>Images</h5>
          {imagePrompts.map((ip) => (
            <SceneMediaPair
              key={ip.id}
              type="image"
              prompt={ip}
              media={ip.generated_image || null}
              onApprove={onApproveImage}
              onReject={onRejectImage}
              onRegenerate={onRegenerateImage}
              disabled={mediaActionDisabled}
              cacheBust={cacheBust}
            />
          ))}
        </div>
      )}

      {/* Video Prompts + Generated Videos */}
      {videoPrompts && videoPrompts.length > 0 && (
        <div className="scene-media-section">
          <h5>Videos</h5>
          {videoPrompts.map((vp) => (
            <SceneMediaPair
              key={vp.id}
              type="video"
              prompt={vp}
              media={vp.generated_video || null}
              onApprove={onApproveVideo}
              onReject={onRejectVideo}
              onRegenerate={onRegenerateVideo}
              disabled={mediaActionDisabled}
              cacheBust={cacheBust}
            />
          ))}
        </div>
      )}
    </div>
  );
}
