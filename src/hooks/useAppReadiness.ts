import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { ensureSupabaseSession } from '@/utils/supabaseSession';

export interface AppReadiness {
  ready: boolean;
  reason?: string;
  userReady: boolean;
  teamReady: boolean;
  sessionReady: boolean;
}

/**
 * Centraliza a prontidão do app: auth + teams + sessão Supabase.
 * Minimiza race conditions no primeiro carregamento após hard reload.
 */
export function useAppReadiness(): AppReadiness {
  const { user, loading: authLoading } = useAuth();
  const { loading: teamLoading, currentTeam } = useTeam();
  const [sessionReady, setSessionReady] = useState(false);
  const settledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await ensureSupabaseSession();
        if (!cancelled) setSessionReady(true);
      } catch {
        if (!cancelled) setSessionReady(false);
      }
    };

    // Tenta garantir sessão assim que auth parar de carregar
    if (!authLoading) {
      run();
    }

    return () => {
      cancelled = true;
    };
  }, [authLoading]);

  const userReady = !!user && !authLoading;
  const teamReady = !!currentTeam && !teamLoading;

  const ready = useMemo(() => {
    return userReady && teamReady && sessionReady;
  }, [userReady, teamReady, sessionReady]);

  let reason: string | undefined;
  if (!userReady) reason = 'aguardando usuário';
  else if (!teamReady) reason = 'aguardando operação';
  else if (!sessionReady) reason = 'aguardando sessão';

  return { ready, reason, userReady, teamReady, sessionReady };
}
