import { useState } from 'react';
import SceneCard from './SceneCard';
import ThumbnailStrip from './ThumbnailStrip';
import EpisodeActionBar from './EpisodeActionBar';

export default function EpisodeDetailPanel({
  episode,
  episodeDetail,
  screenplayText,
  imagePromptsByScene,
  videoPromptsByScene,
  thumbnails,
  generatingAction,
  onApproveEpisode,
  onUnapproveEpisode,
  onResetEpisode,
  onGenerateImgPrompts,
  onGenerateImages,
  onGenerateVidPrompts,
  onGenerateVideos,
  onGenerateThumbnails,
  onApproveImage,
  onRejectImage,
  onRegenerateImage,
  onApproveVideo,
  onRejectVideo,
  onRegenerateVideo,
  onApproveThumbnail,
  onRejectThumbnail,
  onRegenerateThumbnail,
  mediaActionDisabled,
  cacheBust,
}) {
  const [viewMode, setViewMode] = useState('data'); // 'script' | 'data'

  if (!episode) {
    return <div className="episode-detail-panel"><div className="episode-detail-empty">Select an episode from the sidebar</div></div>;
  }

  return (
    <div className="episode-detail-panel">
      {/* Header */}
      <div className="episode-detail-header">
        <h2>Ep {episode.episode_number}: {episode.title}</h2>
        <span className={`badge ${episode.state}`}>{episode.state}</span>
        <div className="view-toggle">
          <button className={`btn btn-sm ${viewMode === 'script' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('script')}>Script</button>
          <button className={`btn btn-sm ${viewMode === 'data' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('data')}>Scenes</button>
        </div>
        {episode.state === 'generated' && <button onClick={onApproveEpisode} className="btn btn-small btn-success">Approve</button>}
        {episode.state === 'approved' && <button onClick={onUnapproveEpisode} className="btn btn-small btn-secondary">Unapprove</button>}
        {episode.state === 'generating' && <button onClick={onResetEpisode} className="btn btn-small btn-warning">Reset</button>}
      </div>

      {/* Action Bar */}
      <EpisodeActionBar
        onGenerateImgPrompts={onGenerateImgPrompts}
        onGenerateImages={onGenerateImages}
        onGenerateVidPrompts={onGenerateVidPrompts}
        onGenerateVideos={onGenerateVideos}
        onGenerateThumbnails={onGenerateThumbnails}
        generatingAction={generatingAction}
      />

      {/* Content */}
      {episodeDetail ? (
        <div className="episode-body">
          {viewMode === 'script' && (
            <div className="screenplay-view">
              {screenplayText ? (
                <pre className="screenplay-text">{screenplayText}</pre>
              ) : (
                <div className="loading-page"><div className="spinner"></div><p>Loading screenplay...</p></div>
              )}
            </div>
          )}

          {viewMode === 'data' && (
            <>
              {episodeDetail.cold_open && (
                <div className="cold-open"><label>Cold Open</label><p>{episodeDetail.cold_open}</p></div>
              )}

              <div className="scenes-list">
                {episodeDetail.scenes.map((scene) => (
                  <SceneCard
                    key={scene.id}
                    scene={scene}
                    imagePrompts={imagePromptsByScene[scene.id] || []}
                    videoPrompts={videoPromptsByScene[scene.id] || []}
                    onApproveImage={onApproveImage}
                    onRejectImage={onRejectImage}
                    onRegenerateImage={onRegenerateImage}
                    onApproveVideo={onApproveVideo}
                    onRejectVideo={onRejectVideo}
                    onRegenerateVideo={onRegenerateVideo}
                    mediaActionDisabled={mediaActionDisabled}
                    cacheBust={cacheBust}
                  />
                ))}
              </div>

              {episodeDetail.cliffhanger_moment && (
                <div className="cliffhanger-section"><label>Cliffhanger</label><p>{episodeDetail.cliffhanger_moment}</p></div>
              )}

              <ThumbnailStrip
                thumbnails={thumbnails}
                onApprove={onApproveThumbnail}
                onReject={onRejectThumbnail}
                onRegenerate={onRegenerateThumbnail}
                disabled={mediaActionDisabled}
                cacheBust={cacheBust}
              />
            </>
          )}
        </div>
      ) : (
        <div className="loading-page"><div className="spinner"></div><p>Loading episode...</p></div>
      )}
    </div>
  );
}
