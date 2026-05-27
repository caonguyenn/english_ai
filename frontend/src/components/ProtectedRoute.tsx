import { Navigate } from 'react-router-dom';
import { useAuthStore, selectIsAuthenticated } from '../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;
  return <>{children}</>;
}
