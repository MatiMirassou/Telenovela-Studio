import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Dashboard from './pages/Dashboard';
import SetupPage from './pages/SetupPage';
import StudioPage from './pages/StudioPage';
import './App.css';

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <div className="app">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects/:id/setup" element={<SetupPage />} />
            <Route path="/projects/:id/studio" element={<StudioPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
