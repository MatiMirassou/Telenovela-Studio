import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';

export default function EpisodesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [episodeDetail, setEpisodeDetail] = useState(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [projectData, episodesData] = await Promise.all([
        api.getProject(id),
        api.getEpisodes(id)
      ]);
      setProject(projectData);
      setEpisodes(episodesData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateBatch = async () => {
    setGenerating(true);
    try {
      const result = await api.generateEpisodes(id, 5);
      await loadData();
      alert(`Generated ${result.episodes_generated} episodes. ${result.remaining} remaining.`);
    } catch (err) {
      console.error('Failed to generate episodes:', err);
      alert('Failed to generate: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const viewEpisode = async (episode) => {
    setSelectedEpisode(episode);
    try {
      const detail = await api.getEpisode(episode.id);
      setEpisodeDetail(detail);
    } catch (err) {
      console.error('Failed to load episode:', err);
    }
  };

  const closeDetail = () => {
    setSelectedEpisode(null);
    setEpisodeDetail(null);
  };

  const generatedCount = episodes.filter(e => e.state !== 'pending').length;
  const totalEpisodes = project?.num_episodes || 20;

  if (loading) {
    return (
      <Layout project={project}>
        <div className="loading-page">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout project={project}>
      <div className="page episodes-page">
        <div className="page-header">
          <h1>Step 5: Episode Scripts</h1>
          <p>Generate full scripts for each episode</p>
        </div>

        <div className="progress-section">
          <div className="progress-info">
            <span>{generatedCount} / {totalEpisodes} episodes generated</span>
            <div className="progress-bar large">
              <div 
                className="progress-fill" 
                style={{ width: `${(generatedCount / totalEpisodes) * 100}%` }}
              ></div>
            </div>
          </div>
          
          {generatedCount < totalEpisodes && (
            <button 
              onClick={generateBatch} 
              disabled={generating}
              className="btn btn-primary"
            >
              {generating ? 'Generating...' : `Generate Next Batch (5 episodes)`}
            </button>
          )}
        </div>

        {generating && (
          <div className="generating-state">
            <div className="spinner large"></div>
            <h2>Generating Scripts...</h2>
            <p>This may take a few minutes</p>
          </div>
        )}

        {episodes.length > 0 && (
          <div className="episodes-grid">
            {episodes.map((ep) => (
              <div 
                key={ep.id} 
                className={`episode-card card ${ep.state}`}
                onClick={() => ep.state !== 'pending' && viewEpisode(ep)}
              >
                <div className="episode-number">Ep {ep.episode_number}</div>
                <h3>{ep.title || 'Generating...'}</h3>
                <div className="episode-meta">
                  <span className={`state-badge ${ep.state}`}>{ep.state}</span>
                  <span>{ep.scenes_count} scenes</span>
                </div>
                {ep.cliffhanger_moment && (
                  <p className="cliffhanger">{ep.cliffhanger_moment}</p>
                )}
              </div>
            ))}
            
            {/* Placeholder cards for ungenerated episodes */}
            {Array.from({ length: totalEpisodes - episodes.length }, (_, i) => (
              <div key={`placeholder-${i}`} className="episode-card card placeholder">
                <div className="episode-number">Ep {episodes.length + i + 1}</div>
                <h3>Not Generated</h3>
              </div>
            ))}
          </div>
        )}

        {/* Episode Detail Modal */}
        {selectedEpisode && (
          <div className="modal-overlay" onClick={closeDetail}>
            <div className="modal-content large" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Episode {selectedEpisode.episode_number}: {selectedEpisode.title}</h2>
                <button onClick={closeDetail} className="btn-close">×</button>
              </div>
              
              {episodeDetail ? (
                <div className="episode-detail">
                  {episodeDetail.cold_open && (
                    <div className="cold-open">
                      <label>Cold Open</label>
                      <p>{episodeDetail.cold_open}</p>
                    </div>
                  )}
                  
                  <div className="scenes-list">
                    {episodeDetail.scenes.map((scene) => (
                      <div key={scene.id} className="scene-card">
                        <div className="scene-header">
                          <span className="scene-number">Scene {scene.scene_number}</span>
                          <h4>{scene.title}</h4>
                          <span className="scene-duration">{scene.duration_seconds}s</span>
                        </div>
                        
                        <div className="scene-meta">
                          <span>📍 {scene.location_id ? 'Location' : 'Unknown'}</span>
                          <span>🌅 {scene.time_of_day}</span>
                          <span>🎭 {scene.mood}</span>
                        </div>
                        
                        <div className="dialogue-list">
                          {scene.dialogue_lines.map((line) => (
                            <div key={line.id} className="dialogue-line">
                              <span className="character">{line.character_name}</span>
                              {line.direction && <span className="direction">({line.direction})</span>}
                              <p className="line-text">{line.line_text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {episodeDetail.cliffhanger_moment && (
                    <div className="cliffhanger-section">
                      <label>Cliffhanger</label>
                      <p>{episodeDetail.cliffhanger_moment}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="loading-page">
                  <div className="spinner"></div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Next Step */}
        {generatedCount >= totalEpisodes && (
          <div className="next-step-bar">
            <span>✓ All episodes generated</span>
            <button 
              onClick={() => navigate(`/projects/${id}/image-prompts`)} 
              className="btn btn-primary btn-large"
            >
              Generate Image Prompts →
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
