import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import EditorPage from './pages/EditorPage';
import MonitoringPage from './pages/MonitoringPage';
import Sidebar from './components/common/Sidebar';
import ToastContainer from './components/common/ToastContainer';
import { ConfirmProvider } from './components/common/ConfirmDialog';

// Layout with sidebar for main pages
function MainLayout({ children }: { children: React.ReactNode }) {
  return <Sidebar>{children}</Sidebar>;
}

function App() {
  return (
    <ConfirmProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<MainLayout><DashboardPage /></MainLayout>} />
          <Route path="/monitoring" element={<MainLayout><MonitoringPage /></MainLayout>} />
          {/* Editor pages without sidebar for full-screen editing */}
          <Route path="/editor/:id" element={<EditorPage />} />
          <Route path="/editor" element={<EditorPage />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer />
    </ConfirmProvider>
  );
}

export default App;
