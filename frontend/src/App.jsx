import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import IdeaTab from './pages/IdeaTab';
import StructureTab from './pages/StructureTab';
import ProductionTab from './pages/ProductionTab';
import PipelinePage from './pages/PipelinePage';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './components/LoginPage';
import api from './api/client';
import './App.css';

function App() {
  const [authState, setAuthState] = useState('loading'); // 'loading' | 'login' | 'ready'

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { auth_required } = await api.getAuthStatus();
      if (!auth_required) {
        setAuthState('ready');
        return;
      }

      // Auth is required — check if we have a valid token
      const token = localStorage.getItem('auth_token');
      if (token) {
        // Try a simple request to see if the token is still valid
        try {
          await api.getApiKeyStatus();
          setAuthState('ready');
        } catch (err) {
          // Token is invalid or expired
          localStorage.removeItem('auth_token');
          setAuthState('login');
        }
      } else {
        setAuthState('login');
      }
    } catch (err) {
      // Can't reach server or auth check failed — assume no auth needed
      console.error('Auth check failed:', err);
      setAuthState('ready');
    }
  };

  const handleLogin = (token) => {
    setAuthState('ready');
  };

  if (authState === 'loading') {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (authState === 'login') {
    return (
      <div className="app">
        <LoginPage onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="app">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            {/* 3-tab project routes */}
            <Route path="/projects/:id/idea" element={<IdeaTab />} />
            <Route path="/projects/:id/structure" element={<StructureTab />} />
            <Route path="/projects/:id/production" element={<ProductionTab />} />
            <Route path="/projects/:id/pipeline" element={<PipelinePage />} />
            {/* Redirect old routes and /projects/:id to idea tab */}
            <Route path="/projects/:id" element={<RedirectToIdea />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </div>
    </BrowserRouter>
  );
}

/** Redirect /projects/:id to /projects/:id/idea */
function RedirectToIdea() {
  const id = window.location.pathname.split('/')[2];
  return <Navigate to={`/projects/${id}/idea`} replace />;
}

export default App;
