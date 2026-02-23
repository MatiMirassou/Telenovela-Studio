export default function EpisodeActionBar({
  onGenerateImgPrompts,
  onGenerateImages,
  onGenerateVidPrompts,
  onGenerateVideos,
  onGenerateThumbnails,
  generatingAction,
}) {
  const isGenerating = !!generatingAction;

  return (
    <div className="episode-action-bar">
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Generate:</span>
      <button
        onClick={onGenerateImgPrompts}
        disabled={isGenerating}
        className="btn btn-secondary"
      >
        {generatingAction === 'img-prompts' ? (
          <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2, marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}></span> Creating Image Prompts...</>
        ) : 'Image Prompts'}
      </button>
      <button
        onClick={onGenerateImages}
        disabled={isGenerating}
        className="btn btn-secondary"
      >
        {generatingAction === 'images' ? (
          <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2, marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}></span> Generating Scene Images...</>
        ) : 'Scene Images'}
      </button>
      <button
        onClick={onGenerateVidPrompts}
        disabled={isGenerating}
        className="btn btn-secondary"
      >
        {generatingAction === 'vid-prompts' ? (
          <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2, marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}></span> Creating Video Prompts...</>
        ) : 'Video Prompts'}
      </button>
      <button
        onClick={onGenerateVideos}
        disabled={isGenerating}
        className="btn btn-secondary"
      >
        {generatingAction === 'videos' ? (
          <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2, marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}></span> Generating Videos...</>
        ) : 'Videos'}
      </button>
      <button
        onClick={onGenerateThumbnails}
        disabled={isGenerating}
        className="btn btn-secondary"
      >
        {generatingAction === 'thumbnails' ? (
          <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2, marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}></span> Generating Thumbnails...</>
        ) : 'Thumbnails'}
      </button>
    </div>
  );
}
