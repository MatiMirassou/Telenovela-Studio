import { Link, useParams } from 'react-router-dom';

export default function Layout({ children, project }) {
  const { id } = useParams();

  return (
    <div className="layout">
      <header className="header">
        <Link to="/" className="logo">Telenovela Agent</Link>
        {project && (
          <div className="project-info">
            <span className="project-title">{project.title || 'Untitled Project'}</span>
            {project.setting && (
              <span className="project-step">{project.setting}</span>
            )}
          </div>
        )}
        <div className="header-actions">
          {project && id && (
            <Link to={`/projects/${id}/studio`} className="btn btn-sm btn-secondary">
              Studio
            </Link>
          )}
        </div>
      </header>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
