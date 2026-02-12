import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Project page just redirects to the appropriate step
export default function ProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to ideas page (or could load project and go to current step)
    navigate(`/projects/${id}/ideas`, { replace: true });
  }, [id, navigate]);

  return (
    <div className="loading-page">
      <div className="spinner"></div>
      <p>Loading project...</p>
    </div>
  );
}
