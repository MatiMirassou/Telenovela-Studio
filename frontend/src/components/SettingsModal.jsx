import { useState, useEffect } from 'react';
import api from '../api/client';

export default function SettingsModal({ onClose }) {
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState(null); // { configured, source }
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success'|'error', text }

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const data = await api.getApiKeyStatus();
      setStatus(data);
    } catch (err) {
      console.error('Failed to load API key status:', err);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: 'Please enter an API key' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const result = await api.setApiKey(apiKey.trim());
      setMessage({ type: 'success', text: result.message || 'API key saved successfully!' });
      setApiKey('');
      await loadStatus();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to save API key' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setMessage(null);

    try {
      const result = await api.deleteApiKey();
      setMessage({ type: 'success', text: result.message || 'API key removed' });
      await loadStatus();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to remove API key' });
    } finally {
      setDeleting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !saving) {
      handleSave();
    }
  };

  const sourceLabel = {
    database: 'Saved in app',
    environment: 'From server environment',
    none: 'Not configured',
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>

        <div className="settings-body">
          {/* API Key Status */}
          <div className="settings-section">
            <h3>Gemini API Key</h3>
            <div className="settings-status">
              <span className={`status-dot ${status?.configured ? 'active' : 'inactive'}`} />
              <span className="status-text">
                {status
                  ? status.configured
                    ? `Configured (${sourceLabel[status.source] || status.source})`
                    : 'Not configured'
                  : 'Loading...'}
              </span>
            </div>

            <p className="settings-hint">
              Enter your Gemini API key to use AI generation features.
              Get one at{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                Google AI Studio
              </a>.
              Your key is stored in the server database and never exposed to the browser.
            </p>
          </div>

          {/* API Key Input */}
          <div className="form-group">
            <label>API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="AIza..."
              className="settings-input"
              disabled={saving}
              autoComplete="off"
            />
          </div>

          {/* Feedback Message */}
          {message && (
            <div className={`settings-message ${message.type}`}>
              {message.text}
            </div>
          )}

          {/* Action Buttons */}
          <div className="settings-actions">
            <button
              onClick={handleSave}
              disabled={saving || !apiKey.trim()}
              className="btn btn-primary"
            >
              {saving ? 'Validating & Saving...' : 'Save Key'}
            </button>

            {status?.configured && status?.source === 'database' && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn btn-danger btn-small"
              >
                {deleting ? 'Removing...' : 'Remove Saved Key'}
              </button>
            )}

            <button onClick={onClose} className="btn btn-secondary">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
