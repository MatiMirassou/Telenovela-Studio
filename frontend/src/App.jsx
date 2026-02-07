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
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
