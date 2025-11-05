
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { GlobalSpinner } from '@/components/GlobalSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute com portão centralizado
 * 
 * Garante que a aplicação NUNCA renderize páginas protegidas até que:
 * 1. Auth esteja pronto (usuário autenticado ou não)
 * 2. Se autenticado, TeamContext esteja pronto (team carregado e selecionado)
 * 
 * Isso previne race conditions após F5 onde páginas eram renderizadas
 * em estado "meio-pronto" (user autenticado mas team não carregado ainda).
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { isContextReady, loading: teamLoading, currentTeam, availableTeams } = useTeam();
  const [diagnosticInfo, setDiagnosticInfo] = useState<any>(null);
  const [startTime] = useState(Date.now());

  // Log diagnóstico detalhado
  useEffect(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const state = {
      timestamp: new Date().toISOString(),
      elapsed: `${elapsed}s`,
      auth: {
        hasUser: !!user,
        userEmail: user?.email || null,
        authLoading,
      },
      team: {
        isContextReady,
        teamLoading,
        hasCurrentTeam: !!currentTeam,
        currentTeamId: currentTeam?.team_id || null,
        currentTeamName: currentTeam?.team_name || null,
        availableTeamsCount: availableTeams.length,
        availableTeams: availableTeams.map(t => ({ id: t.team_id, name: t.team_name })),
      },
    };
    
    setDiagnosticInfo(state);
    
    console.group(`🔍 [ProtectedRoute] DIAGNÓSTICO COMPLETO (${elapsed}s)`);
    console.log('📍 Estado Auth:', state.auth);
    console.log('📍 Estado Team:', state.team);
    console.log('📍 Condições:', {
      authLoading: authLoading ? '❌ BLOQUEANDO' : '✅',
      noUser: !user ? '❌ REDIRECIONANDO' : '✅',
      notReady: (!isContextReady || teamLoading) ? '❌ BLOQUEANDO' : '✅',
    });
    console.groupEnd();
    
    // Log de alerta se estiver carregando há mais de 5 segundos
    if (parseFloat(elapsed) > 5 && (authLoading || teamLoading || !isContextReady)) {
      console.warn(`⚠️ [ProtectedRoute] LOADING PROLONGADO (${elapsed}s) - Estado:`, state);
    }
  }, [user, authLoading, isContextReady, teamLoading, currentTeam, availableTeams, startTime]);

  // 1. Se a autenticação ainda está validando
  if (authLoading) {
    console.log(`[ProtectedRoute] ❌ Auth ainda carregando... (${((Date.now() - startTime) / 1000).toFixed(2)}s)`);
    return <GlobalSpinner />;
  }

  // 2. Se a autenticação falhou ou o usuário não está logado
  if (!user) {
    console.log('[ProtectedRoute] ❌ Usuário não autenticado, redirecionando para login');
    return <Navigate to="/" replace />;
  }

  // 3. Se o usuário ESTÁ logado, mas os times ainda não foram carregados/selecionados
  // (Esse é o estado que o F5 causa - RACE CONDITION)
  if (!isContextReady || teamLoading) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.warn(`[ProtectedRoute] ❌ Usuário autenticado, mas TeamContext não está pronto ainda (${elapsed}s)`, {
      isContextReady,
      teamLoading,
      hasCurrentTeam: !!currentTeam,
      availableTeamsCount: availableTeams.length,
      diagnosticInfo,
    });
    return <GlobalSpinner />;
  }

  // 4. Se chegou aqui, o usuário está logado E o TeamContext está pronto.
  // Só agora podemos renderizar as rotas filhas.
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[ProtectedRoute] ✅ Tudo pronto! Renderizando conteúdo protegido (${elapsed}s)`);
  return <>{children}</>;
};
