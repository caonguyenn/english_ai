import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore, selectPlacementRequired } from './store/authStore';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
// Auth
import LoginPage from './pages/auth/LoginPage';
// Student pages
import Dashboard from './pages/Dashboard';
import PlacementSession from './pages/PlacementSession';
import ModulePage from './pages/modules/ModulePage';
import ClassRoom from './pages/modules/ClassRoom';
import PlaygroundHome from './pages/playground/PlaygroundHome';
import PlaygroundSession from './pages/playground/PlaygroundSession';
import ProfilePage from './pages/profile/ProfilePage';
// Admin pages (Phase 5B)
import AdminLayout from './pages/admin/AdminLayout';
import StudentList from './pages/admin/StudentList';
import StudentDetail from './pages/admin/StudentDetail';
import StudentSessions from './pages/admin/StudentSessions';
import StudentAuditLog from './pages/admin/StudentAuditLog';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function HomeRedirect() {
  const placementRequired = useAuthStore(selectPlacementRequired);
  return placementRequired
    ? <Navigate to="/placement" replace />
    : <Navigate to="/dashboard" replace />;
}

function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    void initialize();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/auth/login" element={<LoginPage />} />

          {/* Root: redirect based on placement status */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomeRedirect />
              </ProtectedRoute>
            }
          />

          {/* Protected — Student */}
          <Route path="/placement" element={<ProtectedRoute><PlacementSession /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/modules/:id" element={<ProtectedRoute><ModulePage /></ProtectedRoute>} />
          <Route path="/class/:id" element={<ProtectedRoute><ClassRoom /></ProtectedRoute>} />
          <Route path="/playground" element={<ProtectedRoute><PlaygroundHome /></ProtectedRoute>} />
          <Route path="/playground/:topic" element={<ProtectedRoute><PlaygroundSession /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

          {/* Admin (Phase 5B) */}
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<StudentList />} />
            <Route path="students/:id" element={<StudentDetail />} />
            <Route path="students/:id/sessions" element={<StudentSessions />} />
            <Route path="students/:id/audit-log" element={<StudentAuditLog />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
