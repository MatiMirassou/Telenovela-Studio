import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { getStepPath } from '../utils/steps';

// Project page redirects to the current step
export default function ProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    api.getProject(id)
      .then((proj) => {
        const path = getStepPath(proj.current_step);
        navigate(`/projects/${id}/${path}`, { replace: true });
      })
      .catch(() => {
        navigate(`/projects/${id}/ideas`, { replace: true });
      });
  }, [id, navigate]);

  return (
    <div className="loading-page">
      <div className="spinner"></div>
      <p>Loading project...</p>
    </div>
  );
}
