import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import StudioTabs from '../components/StudioTabs';
import OverviewTab from '../studio/OverviewTab';
import CharactersTab from '../studio/CharactersTab';
import LocationsTab from '../studio/LocationsTab';
import ScriptsTab from '../studio/ScriptsTab';
import ReferencesTab from '../studio/ReferencesTab';
import ImagePromptsTab from '../studio/ImagePromptsTab';
import ImagesTab from '../studio/ImagesTab';
import ReviewTab from '../studio/ReviewTab';
import VideoPromptsTab from '../studio/VideoPromptsTab';
import VideosTab from '../studio/VideosTab';
import ExportTab from '../studio/ExportTab';
import api from '../api/client';

const TAB_COMPONENTS = {
  'overview': OverviewTab,
  'characters': CharactersTab,
  'locations': LocationsTab,
  'scripts': ScriptsTab,
  'references': ReferencesTab,
  'image-prompts': ImagePromptsTab,
  'images': ImagesTab,
  'review': ReviewTab,
  'video-prompts': VideoPromptsTab,
  'videos': VideosTab,
  'export': ExportTab,
};

export default function StudioPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { loadProject(); }, [id]);

  const loadProject = async () => {
    try {
      const proj = await api.getProject(id);
      setProject(proj);
    } catch (err) {
      console.error('Failed to load project:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout project={project}>
        <div className="loading-page"><div className="spinner"></div><p>Loading studio...</p></div>
      </Layout>
    );
  }

  const TabComponent = TAB_COMPONENTS[activeTab];

  return (
    <Layout project={project}>
      <div className="studio-page">
        <StudioTabs activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="studio-content">
          {TabComponent && (
            <TabComponent project={project} projectId={id} onReload={loadProject} />
          )}
        </div>
      </div>
    </Layout>
  );
}
