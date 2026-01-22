import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import EditorPage from './pages/EditorPage';
import MonitoringPage from './pages/MonitoringPage';
import ToastContainer from './components/common/ToastContainer';
import { ConfirmProvider } from './components/common/ConfirmDialog';

function App() {
  return (
    <ConfirmProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/editor/:id" element={<EditorPage />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/monitoring" element={<MonitoringPage />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer />
    </ConfirmProvider>
  );
}

export default App;
