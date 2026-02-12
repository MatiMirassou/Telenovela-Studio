const TABS = [
  { id: 'overview', name: 'Overview' },
  { id: 'characters', name: 'Characters' },
  { id: 'locations', name: 'Locations' },
  { id: 'scripts', name: 'Scripts' },
  { id: 'references', name: 'References' },
  { id: 'image-prompts', name: 'Img Prompts' },
  { id: 'images', name: 'Images' },
  { id: 'review', name: 'Review' },
  { id: 'video-prompts', name: 'Vid Prompts' },
  { id: 'videos', name: 'Videos' },
  { id: 'export', name: 'Export' },
];

export default function StudioTabs({ activeTab, onTabChange, completedTabs = [] }) {
  return (
    <nav className="studio-tabs">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const isCompleted = completedTabs.includes(tab.id);
        return (
          <button
            key={tab.id}
            className={`studio-tab ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.name}
          </button>
        );
      })}
    </nav>
  );
}

export { TABS };
