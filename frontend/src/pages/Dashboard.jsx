import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { getStepPath, STEP_NAMES } from '../utils/steps';

function PipelineMini({ label, data }) {
  if (!data || data.total === 0) return null;
  return (
    <div className="pipeline-mini">
      <span className="pipeline-label">{label}</span>
      {Object.entries(data.counts).map(([state, count]) => (
        <span key={state} className={`badge ${state}`}>{count} {state}</span>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [pipelines, setPipelines] = useState({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  // Fetch pipeline data for all projects once loaded
  useEffect(() => {
    if (projects.length > 0) {
      Promise.all(
        projects.map((p) =>
          api.getPipeline(p.id).then((data) => [p.id, data]).catch(() => [p.id, null])
        )
      ).then((results) => {
        setPipelines(Object.fromEntries(results.filter(([, d]) => d)));
      });
    }
  }, [projects]);

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
      navigate(`/projects/${project.id}/ideas`);
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
        <h1>Telenovela Agent</h1>
        <p>AI-powered telenovela script generation</p>
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
          {projects.map((project) => {
            const pl = pipelines[project.id];
            return (
              <Link
                to={`/projects/${project.id}/${getStepPath(project.current_step)}`}
                key={project.id}
                className="project-card"
              >
                <div className="project-card-header">
                  <h3>{project.title || 'Untitled Project'}</h3>
                  <button
                    onClick={(e) => deleteProject(project.id, e)}
                    className="btn-icon btn-delete"
                    title="Delete project"
                  >
                    X
                  </button>
                </div>

                {project.setting && (
                  <p className="project-setting">{project.setting}</p>
                )}

                <div className="project-meta">
                  <span className="step-badge">
                    Step {project.current_step}: {STEP_NAMES[project.current_step] || 'Unknown'}
                  </span>
                  <span className="episodes-badge">
                    {project.num_episodes} episodes
                  </span>
                </div>

                {pl ? (
                  <div className="project-pipeline">
                    <PipelineMini label="Episodes" data={pl.episodes} />
                    <PipelineMini label="Images" data={pl.generated_images} />
                    <PipelineMini label="Thumbnails" data={pl.thumbnails} />
                    <PipelineMini label="Videos" data={pl.generated_videos} />
                  </div>
                ) : (
                  <div className="project-stats">
                    <div className="stat">
                      <span className="stat-value">{project.characters_count}</span>
                      <span className="stat-label">Characters</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{project.episodes_generated}</span>
                      <span className="stat-label">Episodes</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{project.images_pending_review}</span>
                      <span className="stat-label">Pending</span>
                    </div>
                  </div>
                )}

                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${(project.current_step / 12) * 100}%` }}
                  ></div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
