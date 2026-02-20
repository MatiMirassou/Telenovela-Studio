import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ProjectPage from './pages/ProjectPage';
import IdeasPage from './pages/IdeasPage';
import StructurePage from './pages/StructurePage';
import EpisodesPage from './pages/EpisodesPage';
import ImagePromptsPage from './pages/ImagePromptsPage';
import ReferencesPage from './pages/ReferencesPage';
import ImagesPage from './pages/ImagesPage';
import ReviewPage from './pages/ReviewPage';
import VideoPromptsPage from './pages/VideoPromptsPage';
import VideosPage from './pages/VideosPage';
import ExportPage from './pages/ExportPage';
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
            <Route path="/projects/:id" element={<ProjectPage />} />
            <Route path="/projects/:id/ideas" element={<IdeasPage />} />
            <Route path="/projects/:id/structure" element={<StructurePage />} />
            <Route path="/projects/:id/episodes" element={<EpisodesPage />} />
            <Route path="/projects/:id/image-prompts" element={<ImagePromptsPage />} />
            <Route path="/projects/:id/references" element={<ReferencesPage />} />
            <Route path="/projects/:id/images" element={<ImagesPage />} />
            <Route path="/projects/:id/review" element={<ReviewPage />} />
            <Route path="/projects/:id/video-prompts" element={<VideoPromptsPage />} />
            <Route path="/projects/:id/videos" element={<VideosPage />} />
            <Route path="/projects/:id/export" element={<ExportPage />} />
            <Route path="/projects/:id/pipeline" element={<PipelinePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </div>
    </BrowserRouter>
  );
}

export default App;
