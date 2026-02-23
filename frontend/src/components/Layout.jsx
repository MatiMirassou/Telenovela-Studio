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

  // Determine active tab from current URL path
  const currentPath = location.pathname.split('/').pop();

  // Fetch pipeline data for badge counts
  useEffect(() => {
    if (id) {
      api.getPipeline(id).then(setPipeline).catch(console.error);
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
        <Link to="/" className="logo">Telenovela Agent</Link>
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
              return (
                <Link
                  key={tab.key}
                  to={`/projects/${id}/${tab.path}`}
                  className={`sidebar-link ${currentPath === tab.path ? 'active' : ''}`}
                >
                  <span className="sidebar-icon">{tab.icon}</span>
                  <span className="sidebar-label">{tab.label}</span>
                  {badge > 0 && (
                    <span className="sidebar-badge">{badge}</span>
                  )}
                </Link>
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
