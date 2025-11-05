import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserTeam } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface TeamContextType {
  currentTeam: UserTeam | null;
  availableTeams: UserTeam[];
  loading: boolean;
  isContextReady: boolean; // Indica se o contexto está totalmente pronto (user autenticado + team carregado/selecionado)
  switchTeam: (teamId: string) => void;
  refreshTeams: () => Promise<void>;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

const CURRENT_TEAM_KEY = 'leadflow_current_team_id';

interface TeamProviderProps {
  children: ReactNode;
}

const normalizeMemberCount = (value: unknown): number => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  return 0;
};

export function TeamProvider({ children }: TeamProviderProps) {
  const [currentTeam, setCurrentTeam] = useState<UserTeam | null>(null);
  const [availableTeams, setAvailableTeams] = useState<UserTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [isContextReady, setIsContextReady] = useState(false);
  const [teamsLoaded, setTeamsLoaded] = useState(false); // Flag para prevenir refetch desnecessário
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const isLoadingRef = useRef(false);

  // Carregar teams do usuário
  const loadUserTeams = useCallback(async () => {
    const startTime = Date.now();
    console.group('🔵 [TeamContext] loadUserTeams INICIOU');
    console.log('📍 Timestamp:', new Date().toISOString());
    
    // Prevenir chamadas simultâneas
    if (isLoadingRef.current) {
      console.warn('⚠️ [TeamContext] Já está carregando, ignorando chamada duplicada');
      console.groupEnd();
      return;
    }

    isLoadingRef.current = true;
    console.log('🔵 [TeamContext] isLoadingRef = true, setLoading(true)');
    
    try {
      setLoading(true);
      
      console.log('🔵 [TeamContext] Buscando usuário autenticado...');
      const userStartTime = Date.now();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      const userElapsed = ((Date.now() - userStartTime) / 1000).toFixed(2);
      console.log(`🔵 [TeamContext] Usuário obtido (${userElapsed}s):`, user?.email || 'NÃO AUTENTICADO', userError || 'sem erro');
      
      if (!user) {
        console.error('❌ [TeamContext] Usuário não autenticado, resetando estado');
        setAvailableTeams([]);
        setCurrentTeam(null);
        setTeamsLoaded(false);
        setIsContextReady(false);
        setLoading(false);
        console.groupEnd();
        return;
      }

      // Chamar função do Supabase que retorna os teams do usuário
      console.log(`🔵 [TeamContext] Chamando get_user_teams() com user_id: ${user.id}...`);
      const rpcStartTime = Date.now();
      const { data, error } = await supabase.rpc('get_user_teams', {
        user_id_param: user.id,
      });
      const rpcElapsed = ((Date.now() - rpcStartTime) / 1000).toFixed(2);
      console.log(`🔵 [TeamContext] Resposta get_user_teams (${rpcElapsed}s):`, {
        dataLength: data?.length || 0,
        data: data,
        error: error ? {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        } : null,
      });

      if (error) {
        const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.error(`❌ [TeamContext] ERRO ao carregar teams (${totalElapsed}s):`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          fullError: error,
        });
        
        // Se a função não existe, significa que as migrations não foram executadas
        if (error.message?.includes('function') || error.message?.includes('does not exist')) {
          console.error('❌ [TeamContext] Função get_user_teams() NÃO EXISTE - Migrations não executadas!');
          toast({
            title: "⚠️ Migrations não executadas",
            description: "Execute as migrations do Supabase antes de usar a aplicação. Veja DEPLOY_EASYPANEL.md",
            variant: "destructive",
          });
        } else {
          console.error('❌ [TeamContext] Erro desconhecido:', error.message);
          toast({
            title: "Erro ao carregar operações",
            description: error.message,
            variant: "destructive",
          });
        }
        setAvailableTeams([]);
        setCurrentTeam(null);
        setTeamsLoaded(false);
        setIsContextReady(false);
        setLoading(false);
        console.groupEnd();
        return;
      }

      const teams = ((data || []) as UserTeam[]).map(team => ({
        ...team,
        member_count: normalizeMemberCount(team.member_count),
      }));

      console.log('✅ [TeamContext] Teams recebidos:', teams.length, 'teams');
      console.log('✅ [TeamContext] Detalhes teams:', teams);
      setAvailableTeams(teams);

      // Se não tem teams, usuário precisa criar um
      if (teams.length === 0) {
        console.log('⚠️ [TeamContext] NENHUM team encontrado para o usuário');
        setCurrentTeam(null);
        setTeamsLoaded(true); // Teams foram carregados (mesmo que vazio)
        setIsContextReady(false); // Mas não está pronto pois não tem team selecionado
        setLoading(false);
        return;
      }

      // Tentar restaurar team salvo no localStorage
      const savedTeamId = localStorage.getItem(CURRENT_TEAM_KEY);
      console.log('🔵 [TeamContext] Team salvo no localStorage:', savedTeamId);
      const savedTeam = teams.find(t => t.team_id === savedTeamId);

      let teamToSelect: UserTeam;
      if (savedTeam) {
        console.log('✅ [TeamContext] Restaurando team salvo:', savedTeam.team_name);
        teamToSelect = savedTeam;
      } else {
        console.log('🔵 [TeamContext] Nenhum team salvo, selecionando primeiro:', teams[0].team_name);
        // Se não tem team salvo, selecionar o primeiro
        teamToSelect = teams[0];
        localStorage.setItem(CURRENT_TEAM_KEY, teams[0].team_id);
      }

      // IMPORTANTE: Setar currentTeam ANTES de setLoading(false) para evitar race conditions
      setCurrentTeam(teamToSelect);
      setTeamsLoaded(true); // Marca que teams foram carregados
      setIsContextReady(true); // Contexto está pronto - user autenticado + team selecionado
      
      const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ [TeamContext] currentTeam setado: ${teamToSelect.team_name} (${totalElapsed}s)`);
      console.log('✅ [TeamContext] isContextReady = true');
      console.log('✅ [TeamContext] setLoading(false) - Carregamento completo');
      console.log('📍 Estado final:', {
        teamsCount: teams.length,
        currentTeamId: teamToSelect.team_id,
        currentTeamName: teamToSelect.team_name,
        teamsLoaded: true,
        isContextReady: true,
      });
      setLoading(false);
      console.groupEnd();
    } catch (err) {
      const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`❌ [TeamContext] ERRO INESPERADO ao carregar teams (${totalElapsed}s):`, err);
      console.error('📍 Stack trace:', err instanceof Error ? err.stack : 'N/A');
      setTeamsLoaded(false);
      setIsContextReady(false);
      setLoading(false);
      console.groupEnd();
    } finally {
      console.log('🔵 [TeamContext] isLoadingRef = false (finally)');
      isLoadingRef.current = false;
    }
  }, [toast]);

  // Trocar de operação
  const switchTeam = (teamId: string) => {
    console.log('🟣 [TeamContext] switchTeam CALLED with teamId:', teamId);
    console.log('🟣 [TeamContext] availableTeams:', availableTeams.length);
    
    const team = availableTeams.find(t => t.team_id === teamId);
    
    if (!team) {
      console.error('🟣❌ [TeamContext] Team NÃO ENCONTRADO:', teamId);
      toast({
        title: "Operação não encontrada",
        variant: "destructive",
      });
      return;
    }

    console.log('🟣✅ [TeamContext] Team encontrado:', team.team_name);
    setCurrentTeam(team);
    localStorage.setItem(CURRENT_TEAM_KEY, teamId);
    console.log('🟣✅ [TeamContext] currentTeam atualizado e salvo no localStorage');
    
    toast({
      title: "Operação alterada",
      description: `Você está agora em: ${team.team_name}`,
    });
  };

  // Recarregar teams (útil após criar novo team ou ser adicionado a um)
  const refreshTeams = async () => {
    console.log('🟣 [TeamContext] refreshTeams chamado - resetando flags e recarregando');
    setTeamsLoaded(false); // Resetar flag para permitir recarregar
    setIsContextReady(false);
    await loadUserTeams();
  };

  // ✅ CRITICAL FIX: Carregar teams apenas UMA VEZ quando autenticado
  // Este effect só roda quando authState muda ou quando teams ainda não foram carregados
  useEffect(() => {
    console.log('🟢 [TeamContext] useEffect PRINCIPAL - authLoading:', authLoading, 'user:', user?.email || 'null', 'teamsLoaded:', teamsLoaded);
    
    // Se auth ainda está carregando, aguardar
    if (authLoading) {
      console.log('🟢 [TeamContext] Auth ainda carregando, aguardando...');
      setIsContextReady(false);
      return;
    }

    // Se não tem usuário, limpar estado
    if (!user) {
      console.log('⚠️ [TeamContext] Usuário não autenticado, resetando estado');
      setAvailableTeams([]);
      setCurrentTeam(null);
      setTeamsLoaded(false);
      setIsContextReady(false);
      setLoading(false);
      return;
    }

    // ✅ MÁGICA: Só carregar teams se ainda não foram carregados
    // Isso previne refetch desnecessário em cada navegação
    if (user && !teamsLoaded) {
      console.log('🟢 [TeamContext] Auth pronto, usuário autenticado, teams NÃO carregados ainda - carregando teams...');
      loadUserTeams();
    } else if (user && teamsLoaded) {
      // Teams já foram carregados
      if (currentTeam) {
        // Tem team selecionado - contexto está pronto
        console.log('🟢 [TeamContext] Teams já carregados e team selecionado - contexto pronto');
        setIsContextReady(true);
      } else if (availableTeams.length > 0) {
        // Tem teams mas nenhum selecionado - recovery mechanism vai lidar com isso
        console.log('🟢 [TeamContext] Teams carregados mas nenhum selecionado - aguardando recovery');
      } else {
        // Teams carregados mas vazios - usuário precisa criar um
        console.log('🟢 [TeamContext] Teams carregados mas vazios - usuário precisa criar um');
        setIsContextReady(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, teamsLoaded]); // teamsLoaded na deps previne refetch

  // Escutar mudanças de autenticação para casos específicos (SIGNED_OUT)
  useEffect(() => {
    console.log('🟢 [TeamContext] Configurando listener de auth state changes...');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🟢 [TeamContext] onAuthStateChange:', event, session?.user?.email || 'sem sessão');
      
      // Apenas tratar SIGNED_OUT aqui, SIGNED_IN já é tratado pelo useEffect acima
      if (event === 'SIGNED_OUT') {
        console.log('🟢 [TeamContext] SIGNED_OUT detectado, limpando estado');
        setAvailableTeams([]);
        setCurrentTeam(null);
        setTeamsLoaded(false);
        setIsContextReady(false);
        localStorage.removeItem(CURRENT_TEAM_KEY);
        setLoading(false);
      }
    });

    return () => {
      console.log('🔴 [TeamContext] Cleanup listener de auth state changes');
      subscription.unsubscribe();
    };
  }, []);

  // ✅ RECOVERY MECHANISM: Se state foi perdido após F5, tentar recuperar
  // Este effect garante que se os teams foram carregados mas currentTeam não foi setado, ele será setado
  useEffect(() => {
    // Se não está carregando e tem teams disponíveis mas não tem team selecionado
    if (!loading && !authLoading && availableTeams.length > 0 && !currentTeam) {
      const savedTeamId = localStorage.getItem(CURRENT_TEAM_KEY);
      console.log('🔧 [TeamContext] RECOVERY ATIVADO - savedTeamId:', savedTeamId, 'availableTeams:', availableTeams.length);
      
      let teamToSelect: UserTeam | null = null;
      
      if (savedTeamId) {
        const savedTeam = availableTeams.find(t => t.team_id === savedTeamId);
        if (savedTeam) {
          console.log('✅ [TeamContext] RECOVERY - Team recuperado do localStorage:', savedTeam.team_name);
          teamToSelect = savedTeam;
        } else {
          console.warn('⚠️ [TeamContext] RECOVERY - Team salvo não encontrado, usando primeiro');
          teamToSelect = availableTeams[0];
        }
      } else {
        console.log('🔧 [TeamContext] RECOVERY - Nenhum team salvo, selecionando primeiro');
        teamToSelect = availableTeams[0];
      }
      
      if (teamToSelect) {
        setCurrentTeam(teamToSelect);
        setIsContextReady(true); // Marcar contexto como pronto após recovery
        localStorage.setItem(CURRENT_TEAM_KEY, teamToSelect.team_id);
        console.log('✅ [TeamContext] RECOVERY COMPLETO - Team selecionado:', teamToSelect.team_name);
        console.log('✅ [TeamContext] isContextReady = true (recovery)');
      }
    }
  }, [loading, authLoading, currentTeam, availableTeams]);

  // Memoizar o value para evitar re-renders desnecessários
  const value = useMemo<TeamContextType>(() => ({
    currentTeam,
    availableTeams,
    loading,
    isContextReady,
    switchTeam,
    refreshTeams,
  }), [currentTeam, availableTeams, loading, isContextReady, switchTeam, refreshTeams]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

// Hook personalizado para usar o TeamContext
export function useTeam() {
  const context = useContext(TeamContext);
  
  if (context === undefined) {
    throw new Error('useTeam deve ser usado dentro de um TeamProvider');
  }
  
  return context;
}
