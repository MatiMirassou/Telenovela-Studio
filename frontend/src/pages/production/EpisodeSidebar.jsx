export default function EpisodeSidebar({
  episodes,
  totalEpisodes,
  selectedEpisodeId,
  onSelectEpisode,
  onGenerateBatch,
  generating,
}) {
  const generatedCount = episodes.filter(e => e.state !== 'pending').length;

  return (
    <div className="episode-sidebar">
      <div className="episode-sidebar-header">
        <h3>Episodes</h3>
        <div className="episode-sidebar-progress">
          <span>{generatedCount}/{totalEpisodes} generated</span>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(generatedCount / totalEpisodes) * 100}%` }} />
          </div>
        </div>
        {generatedCount < totalEpisodes && (
          <button
            onClick={onGenerateBatch}
            disabled={generating}
            className="btn btn-primary btn-small btn-full"
          >
            {generating ? (
              <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2, marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}></span> Generating Scripts...</>
            ) : 'Generate Next 5 Scripts'}
          </button>
        )}
        {generatedCount >= totalEpisodes && (
          <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>All scripts generated</span>
        )}
      </div>

      <div className="episode-list">
        {episodes.map((ep) => (
          <div
            key={ep.id}
            className={`episode-row ${ep.id === selectedEpisodeId ? 'active' : ''} ${ep.state === 'pending' ? 'is-pending' : ''}`}
            onClick={() => ep.state !== 'pending' && onSelectEpisode(ep.id)}
          >
            <span className="ep-num">{ep.episode_number}</span>
            <span className="ep-title">{ep.title || 'Pending...'}</span>
            <span className={`ep-state badge ${ep.state}`}>{ep.state}</span>
          </div>
        ))}

        {/* Placeholder rows for ungenerated episodes */}
        {Array.from({ length: totalEpisodes - episodes.length }, (_, i) => (
          <div key={`ph-${i}`} className="episode-row is-pending">
            <span className="ep-num">{episodes.length + i + 1}</span>
            <span className="ep-title">Not generated</span>
          </div>
        ))}
      </div>
    </div>
  );
}
