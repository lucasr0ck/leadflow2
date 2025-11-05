
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
  const { isContextReady, loading: teamLoading } = useTeam();

  // 1. Se a autenticação ainda está validando
  if (authLoading) {
    console.log('[ProtectedRoute] Auth ainda carregando...');
    return <GlobalSpinner />;
  }

  // 2. Se a autenticação falhou ou o usuário não está logado
  if (!user) {
    console.log('[ProtectedRoute] Usuário não autenticado, redirecionando para login');
    return <Navigate to="/" replace />;
  }

  // 3. Se o usuário ESTÁ logado, mas os times ainda não foram carregados/selecionados
  // (Esse é o estado que o F5 causa - RACE CONDITION)
  if (!isContextReady || teamLoading) {
    console.log('[ProtectedRoute] Usuário autenticado, mas TeamContext não está pronto ainda. Aguardando...', {
      isContextReady,
      teamLoading,
    });
    return <GlobalSpinner />;
  }

  // 4. Se chegou aqui, o usuário está logado E o TeamContext está pronto.
  // Só agora podemos renderizar as rotas filhas.
  console.log('[ProtectedRoute] Tudo pronto! Renderizando conteúdo protegido.');
  return <>{children}</>;
};
