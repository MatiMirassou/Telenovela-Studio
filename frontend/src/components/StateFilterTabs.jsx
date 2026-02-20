/**
 * Reusable state filter tabs for microsite pages.
 * Shows "All" + state-specific tabs. Active state is highlighted.
 */
export default function StateFilterTabs({ states, activeState, onChange }) {
  return (
    <div className="state-filter-tabs">
      <button
        className={`filter-tab ${!activeState ? 'active' : ''}`}
        onClick={() => onChange(null)}
      >
        All
      </button>
      {states.map((s) => (
        <button
          key={s.value}
          className={`filter-tab ${activeState === s.value ? 'active' : ''}`}
          onClick={() => onChange(s.value)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
