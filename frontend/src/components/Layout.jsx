import { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import api from '../api/client';
import { STEPS, getBadgeCount } from '../utils/steps';

export default function Layout({ children, project, currentStep }) {
  const { id } = useParams();
  const location = useLocation();
  const [pipeline, setPipeline] = useState(null);

  const step = currentStep || project?.current_step || 1;

  // Fetch pipeline data for badge counts
  useEffect(() => {
    if (id) {
      api.getPipeline(id).then(setPipeline).catch(console.error);
    }
  }, [id]);

  return (
    <div className="layout">
      <header className="header">
        <Link to="/" className="logo">Telenovela Agent</Link>
        {project && (
          <div className="project-info">
            <span className="project-title">{project.title || 'Untitled Project'}</span>
          </div>
        )}
      </header>

      {project && (
        <nav className="step-nav">
          {STEPS.map((s) => {
            const badge = getBadgeCount(s.num, pipeline);
            return (
              <Link
                key={s.num}
                to={`/projects/${id}/${s.path}`}
                className={`step-link ${s.num === step ? 'active' : ''} ${s.num < step ? 'completed' : ''}`}
              >
                <span className="step-num">{s.num}</span>
                <span className="step-name">{s.name}</span>
                {badge > 0 && (
                  <span className="step-badge-count">{badge}</span>
                )}
              </Link>
            );
          })}
        </nav>
      )}

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
