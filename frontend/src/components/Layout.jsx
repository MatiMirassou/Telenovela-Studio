import { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import api from '../api/client';
import { TABS, getTabBadgeCount } from '../utils/steps';
import SettingsModal from './SettingsModal';

export default function Layout({ children, project }) {
  const { id } = useParams();
  const location = useLocation();
  const [pipeline, setPipeline] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [productionExpanded, setProductionExpanded] = useState(false);

  // Determine if we're on a production-related route
  const pathname = location.pathname;
  const isProductionRoute = pathname.includes('/production');
  const isEpisodeRoute = /\/production\/\d+/.test(pathname);

  // Determine active tab from URL
  const pathParts = pathname.split('/');
  const currentPath = isEpisodeRoute ? 'production' : pathParts[pathParts.length - 1];

  // Extract current episode number from URL if on episode page
  const currentEpNum = isEpisodeRoute ? pathParts[pathParts.length - 1] : null;

  // Auto-expand production when on a production route
  useEffect(() => {
    if (isProductionRoute) {
      setProductionExpanded(true);
    }
  }, [isProductionRoute]);

  // Fetch pipeline data for badge counts
  useEffect(() => {
    if (id) {
      api.getPipeline(id).then(setPipeline).catch(console.error);
    }
  }, [id]);

  // Fetch episodes for sidebar sub-items
  useEffect(() => {
    if (id) {
      api.getEpisodes(id).then(setEpisodes).catch(console.error);
    }
  }, [id]);

  // Check API key status on mount
  useEffect(() => {
    api.getApiKeyStatus()
      .then((data) => setApiKeyConfigured(data.configured))
      .catch(() => setApiKeyConfigured(null));
  }, [showSettings]);

  return (
    <div className="layout">
      <header className="header">
        <Link to="/" className="logo">
          <svg className="logo-icon" width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
            <circle cx="18" cy="18" r="18" fill="#E8751A"/>
            <text x="18" y="13" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" fontFamily="Arial, sans-serif" dy="0">Lingo</text>
            <text x="18" y="24" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700" fontFamily="Arial, sans-serif" dy="0">Pie.</text>
          </svg>
          <span className="logo-text">Telenovela Studio</span>
        </Link>
        {project && (
          <div className="project-info">
            <span className="project-title">{project.title || 'Untitled Project'}</span>
          </div>
        )}
        <button
          className="btn-settings"
          onClick={() => setShowSettings(true)}
          title={apiKeyConfigured === false ? 'Settings - API key not configured!' : 'Settings'}
        >
          {apiKeyConfigured === false && <span className="settings-warning-dot" />}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </button>
      </header>

      {project && (
        <div className="layout-body">
          <nav className="sidebar">
            <Link
              to={`/projects/${id}/pipeline`}
              className={`sidebar-link pipeline-link ${currentPath === 'pipeline' ? 'active' : ''}`}
            >
              <span className="sidebar-icon">📊</span>
              <span className="sidebar-label">Pipeline</span>
            </Link>

            <div className="sidebar-divider" />

            {TABS.map((tab) => {
              const badge = getTabBadgeCount(tab.key, pipeline);
              const isProduction = tab.key === 'production';
              const isActive = isProduction ? isProductionRoute : currentPath === tab.path;

              return (
                <div key={tab.key}>
                  {/* Main tab link */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Link
                      to={`/projects/${id}/${tab.path}`}
                      className={`sidebar-link ${isActive ? 'active' : ''}`}
                      style={{ flex: 1 }}
                    >
                      <span className="sidebar-icon">{tab.icon}</span>
                      <span className="sidebar-label">{tab.label}</span>
                      {badge > 0 && (
                        <span className="sidebar-badge">{badge}</span>
                      )}
                    </Link>
                    {isProduction && episodes.length > 0 && (
                      <button
                        onClick={(e) => { e.preventDefault(); setProductionExpanded(!productionExpanded); }}
                        className="sidebar-expand-btn"
                        title={productionExpanded ? 'Collapse episodes' : 'Expand episodes'}
                      >
                        <span style={{
                          display: 'inline-block',
                          transform: productionExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.15s',
                          fontSize: '0.7rem',
                        }}>
                          ▶
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Episode sub-items (only for production) */}
                  {isProduction && productionExpanded && episodes.length > 0 && (
                    <div className="sidebar-subitems">
                      {episodes.filter(ep => ep.state !== 'pending').map((ep) => (
                        <Link
                          key={ep.id}
                          to={`/projects/${id}/production/${ep.episode_number}`}
                          className={`sidebar-sublink ${String(currentEpNum) === String(ep.episode_number) ? 'active' : ''}`}
                        >
                          <span className="ep-num-badge">{ep.episode_number}</span>
                          <span className="sidebar-sublabel">{ep.title || `Episode ${ep.episode_number}`}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <main className="main-content">
            {children}
          </main>
        </div>
      )}

      {!project && (
        <main className="main-content">
          {children}
        </main>
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
