import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { GlobalSpinner } from '@/components/GlobalSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute - Simplified version
 * 
 * Only renders protected pages when:
 * 1. Auth is complete (user authenticated or not)
 * 2. If authenticated, teams are loaded (or confirmed as empty)
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isVerifyingAuth } = useAuth();
  const location = useLocation();
  const { loading: teamLoading, currentTeam, availableTeams } = useTeam();

  useEffect(() => {
    console.log('[ProtectedRoute] State:', {
  isVerifyingAuth,
      teamLoading,
      hasUser: !!user,
      hasTeam: !!currentTeam,
      teamsCount: availableTeams.length,
    });
  }, [isVerifyingAuth, teamLoading, user, currentTeam, availableTeams]);

  // Bloqueio de verificação já tratado em AppInner. Só por segurança se chegar aqui.
  if (isVerifyingAuth) {
    console.log('[ProtectedRoute] (redundant) Still verifying auth');
    return <GlobalSpinner />;
  }

  // No user? Redirect to login
  if (!user) {
    console.log('[ProtectedRoute] No user, redirecting to /login');
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Wait for teams to load
  if (teamLoading) {
    console.log('[ProtectedRoute] Waiting for teams');
    return <GlobalSpinner />;
  }

  // Everything ready - render protected content
  console.log('[ProtectedRoute] Ready - rendering');
  return <>{children}</>;
};
