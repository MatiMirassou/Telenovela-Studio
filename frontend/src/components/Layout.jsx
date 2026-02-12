import { Link, useParams, useLocation } from 'react-router-dom';

const STEPS = [
  { num: 1, name: 'Ideas', path: 'ideas' },
  { num: 2, name: 'Select', path: 'ideas' },
  { num: 3, name: 'Structure', path: 'structure' },
  { num: 4, name: 'Approve', path: 'structure' },
  { num: 5, name: 'Scripts', path: 'episodes' },
  { num: 6, name: 'Img Prompts', path: 'image-prompts' },
  { num: 7, name: 'References', path: 'references' },
  { num: 8, name: 'Images', path: 'images' },
  { num: 9, name: 'Thumbnails', path: 'images' },
  { num: 10, name: 'Review', path: 'review' },
  { num: 11, name: 'Vid Prompts', path: 'video-prompts' },
  { num: 12, name: 'Videos', path: 'videos' },
];

export default function Layout({ children, project, currentStep }) {
  const { id } = useParams();
  const location = useLocation();
  
  const step = currentStep || project?.current_step || 1;

  return (
    <div className="layout">
      <header className="header">
        <Link to="/" className="logo">🎬 Telenovela Agent</Link>
        {project && (
          <div className="project-info">
            <span className="project-title">{project.title || 'Untitled Project'}</span>
            <span className="project-step">Step {step}/12</span>
          </div>
        )}
      </header>

      {project && (
        <nav className="step-nav">
          {STEPS.map((s) => (
            <Link
              key={s.num}
              to={`/projects/${id}/${s.path}`}
              className={`step-link ${s.num === step ? 'active' : ''} ${s.num < step ? 'completed' : ''} ${s.num > step ? 'disabled' : ''}`}
            >
              <span className="step-num">{s.num}</span>
              <span className="step-name">{s.name}</span>
            </Link>
          ))}
        </nav>
      )}

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
