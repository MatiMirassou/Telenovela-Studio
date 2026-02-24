import { useState } from 'react';
import api from '../api/client';

export default function LoginPage({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter a password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await api.login(password.trim());
      // Store token in localStorage
      localStorage.setItem('auth_token', result.token);
      onLogin(result.token);
    } catch (err) {
      setError(err.message || 'Incorrect password');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">
            <svg width="40" height="40" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }}>
              <circle cx="18" cy="18" r="18" fill="#E8751A"/>
              <text x="18" y="13" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" fontFamily="Arial, sans-serif" dy="0">Lingo</text>
              <text x="18" y="24" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700" fontFamily="Arial, sans-serif" dy="0">Pie.</text>
            </svg>
            Telenovela Studio
          </h1>
          <p className="login-subtitle">Enter password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Password"
              className="login-input"
              disabled={loading}
              autoFocus
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="login-error">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="btn btn-primary btn-full"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
