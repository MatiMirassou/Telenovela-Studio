import { useState } from 'react';
import api from '../api/client';

export default function ExportTab({ project, projectId }) {
  const [scripts, setScripts] = useState(null);
  const [prompts, setPrompts] = useState(null);

  const loadScripts = async () => {
    const data = await api.getScriptsExport(projectId);
    setScripts(data);
  };

  const loadPrompts = async () => {
    const data = await api.getPromptsExport(projectId);
    setPrompts(data);
  };

  return (
    <div className="tab-content export-tab">
      <div className="page-header">
        <h2>Export Project</h2>
        <p>Download your telenovela content</p>
      </div>

      <div className="export-cards">
        <div className="export-card card">
          <h3>Full Project JSON</h3>
          <p>Complete project data including all structure, scripts, prompts, and assets</p>
          <a href={api.getExportUrl(projectId)} download className="btn btn-primary">
            Download JSON
          </a>
        </div>

        <div className="export-card card">
          <h3>Scripts Only</h3>
          <p>Episode scripts with scenes and dialogue</p>
          <button onClick={loadScripts} className="btn btn-secondary">
            Preview Scripts
          </button>
          {scripts && (
            <pre className="export-preview">{JSON.stringify(scripts, null, 2)}</pre>
          )}
        </div>

        <div className="export-card card">
          <h3>All Prompts</h3>
          <p>Image and video generation prompts</p>
          <button onClick={loadPrompts} className="btn btn-secondary">
            Preview Prompts
          </button>
          {prompts && (
            <pre className="export-preview">{JSON.stringify(prompts, null, 2)}</pre>
          )}
        </div>

        <div className="export-card card">
          <h3>Screenplay Format</h3>
          <p>Full screenplay export for all episodes</p>
          <a href={api.getScreenplayExportUrl(projectId)} download className="btn btn-secondary">
            Download Screenplay
          </a>
        </div>
      </div>
    </div>
  );
}
