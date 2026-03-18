import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './shared/components/Sidebar';
import ToastContainer from './shared/components/ToastContainer';
import { ConfirmProvider } from './shared/components/ConfirmDialog';
import { InputProvider } from './shared/components/InputDialog';
import { ErrorBoundary } from './shared/components/ErrorBoundary';

const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const EditorPage = lazy(() => import('./features/editor/EditorPage'));
const MonitoringPage = lazy(() => import('./features/monitoring/MonitoringPage'));
const ExecutionsPage = lazy(() => import('./features/executions/ExecutionsPage'));
const NotFoundPage = lazy(() => import('./shared/components/NotFoundPage'));

function LoadingFallback() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      color: 'var(--text-muted)',
    }}>
      Loading...
    </div>
  );
}

// Layout with sidebar for main pages
function MainLayout({ children }: { children: React.ReactNode }) {
  return <Sidebar>{children}</Sidebar>;
}

function App() {
  return (
    <ErrorBoundary>
    <ConfirmProvider>
      <InputProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<MainLayout><DashboardPage /></MainLayout>} />
              <Route path="/monitoring" element={<MainLayout><MonitoringPage /></MainLayout>} />
              <Route path="/executions" element={<MainLayout><ExecutionsPage /></MainLayout>} />
              {/* Editor pages without sidebar for full-screen editing */}
              <Route path="/editor/:id" element={<EditorPage />} />
              <Route path="/editor" element={<EditorPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <ToastContainer />
      </InputProvider>
    </ConfirmProvider>
    </ErrorBoundary>
  );
}

export default App;
