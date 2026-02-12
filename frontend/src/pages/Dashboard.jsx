import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { loadProjects(); }, []);

  const loadProjects = async () => {
    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    setCreating(true);
    try {
      const project = await api.createProject({ num_episodes: 20 });
      navigate(`/projects/${project.id}/setup`);
    } catch (err) {
      console.error('Failed to create project:', err);
      alert('Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const deleteProject = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this project?')) return;
    try {
      await api.deleteProject(id);
      setProjects(projects.filter(p => p.id !== id));
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const getProjectLink = (project) => {
    const hasStructure = project.characters_count > 0;
    const hasIdea = project.current_step >= 3;
    if (hasStructure || hasIdea) return `/projects/${project.id}/studio`;
    return `/projects/${project.id}/setup`;
  };

  if (loading) {
    return (
      <div className="dashboard loading">
        <div className="spinner"></div>
        <p>Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1 className="gradient-title">Telenovela Agent</h1>
        <p className="dashboard-subtitle">AI-powered telenovela script generation</p>
      </header>

      <div className="dashboard-actions">
        <button onClick={createProject} disabled={creating} className="btn btn-primary btn-large">
          {creating ? 'Creating...' : '+ New Project'}
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <h2>No projects yet</h2>
          <p>Create your first telenovela project to get started</p>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((project) => (
            <Link to={getProjectLink(project)} key={project.id} className="project-card card">
              <div className="project-card-header">
                <h3>{project.title || 'Untitled Project'}</h3>
                <button
                  onClick={(e) => deleteProject(project.id, e)}
                  className="btn-close"
                  title="Delete project"
                >
                  &times;
                </button>
              </div>

              {project.setting && (
                <p className="project-setting">{project.setting}</p>
              )}

              <div className="project-meta">
                <span className="badge">{project.num_episodes} episodes</span>
              </div>

              <div className="project-stats">
                <div className="stat">
                  <span className="stat-value">{project.characters_count || 0}</span>
                  <span className="stat-label">Characters</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{project.episodes_generated || 0}</span>
                  <span className="stat-label">Scripts</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{project.images_pending_review || 0}</span>
                  <span className="stat-label">Pending</span>
                </div>
              </div>

              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${(project.current_step / 12) * 100}%` }}
                ></div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
