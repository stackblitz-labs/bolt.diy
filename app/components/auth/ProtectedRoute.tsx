import { useEffect } from 'react';
import { useNavigate } from '@remix-run/react';
import { useStore } from '@nanostores/react';
import { authStore } from '~/lib/stores/auth';
import { motion } from 'framer-motion';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const authState = useStore(authStore);

  useEffect(() => {
    // If not loading and not authenticated, redirect to auth page
    if (!authState.loading && !authState.isAuthenticated) {
      navigate('/auth');
    }
  }, [authState.loading, authState.isAuthenticated, navigate]);

  // Show loading state
  if (authState.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bolt-elements-background-depth-1">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-bolt-elements-background-depth-2 flex items-center justify-center">
            <span className="i-svg-spinners:3-dots-scale text-2xl text-bolt-elements-textPrimary" />
          </div>
          <p className="text-bolt-elements-textSecondary">Loading your workspace...</p>
        </motion.div>
      </div>
    );
  }

  // If not authenticated, don't render children (will redirect)
  if (!authState.isAuthenticated) {
    return null;
  }

  // Render protected content
  return <>{children}</>;
}

// HOC for protecting pages
export function withAuth<P extends object>(wrappedComponent: React.ComponentType<P>) {
  const Component = wrappedComponent;

  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}
