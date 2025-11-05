import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserTeam } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

interface TeamContextType {
  currentTeam: UserTeam | null;
  availableTeams: UserTeam[];
  loading: boolean;
  switchTeam: (teamId: string) => void;
  refreshTeams: () => Promise<void>;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

const CURRENT_TEAM_KEY = 'leadflow_current_team_id';

interface TeamProviderProps {
  children: ReactNode;
}

export function TeamProvider({ children }: TeamProviderProps) {
  const [currentTeam, setCurrentTeam] = useState<UserTeam | null>(null);
  const [availableTeams, setAvailableTeams] = useState<UserTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const isLoadingRef = useRef(false);
  const recoveryAttemptedRef = useRef(false);

  // Carregar teams do usuário
  const loadUserTeams = useCallback(async () => {
    console.log('🔵 [TeamContext] loadUserTeams INICIOU');
    
    // Prevenir chamadas simultâneas
    if (isLoadingRef.current) {
      console.log('⚠️ [TeamContext] Já está carregando, ignorando chamada duplicada');
      return;
    }

    isLoadingRef.current = true;
    console.log('🔵 [TeamContext] isLoadingRef = true, setLoading(true)');
    
    try {
      setLoading(true);
      
      console.log('🔵 [TeamContext] Buscando usuário autenticado...');
      const { data: { user } } = await supabase.auth.getUser();
      console.log('🔵 [TeamContext] Usuário:', user?.email || 'NÃO AUTENTICADO');
      
      if (!user) {
        console.log('❌ [TeamContext] Usuário não autenticado, resetando estado');
        setAvailableTeams([]);
        setCurrentTeam(null);
        setLoading(false);
        return;
      }

      // Chamar função do Supabase que retorna os teams do usuário
      console.log('🔵 [TeamContext] Chamando get_user_teams()...');
      const { data, error } = await supabase.rpc('get_user_teams');
      console.log('🔵 [TeamContext] Resposta get_user_teams:', { data, error });

      if (error) {
        console.error('❌ [TeamContext] ERRO ao carregar teams:', error);
        
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
        setLoading(false);
        return;
      }

      const teams = (data || []) as UserTeam[];
      console.log('✅ [TeamContext] Teams recebidos:', teams.length, 'teams');
      console.log('✅ [TeamContext] Detalhes teams:', teams);
      setAvailableTeams(teams);

      // Se não tem teams, usuário precisa criar um
      if (teams.length === 0) {
        console.log('⚠️ [TeamContext] NENHUM team encontrado para o usuário');
        setCurrentTeam(null);
        setLoading(false);
        return;
      }

      // Tentar restaurar team salvo no localStorage
      const savedTeamId = localStorage.getItem(CURRENT_TEAM_KEY);
      console.log('🔵 [TeamContext] Team salvo no localStorage:', savedTeamId);
      const savedTeam = teams.find(t => t.team_id === savedTeamId);

      if (savedTeam) {
        console.log('✅ [TeamContext] Restaurando team salvo:', savedTeam.team_name);
        setCurrentTeam(savedTeam);
      } else {
        console.log('🔵 [TeamContext] Nenhum team salvo, selecionando primeiro:', teams[0].team_name);
        // Se não tem team salvo, selecionar o primeiro
        setCurrentTeam(teams[0]);
        localStorage.setItem(CURRENT_TEAM_KEY, teams[0].team_id);
      }

      console.log('✅ [TeamContext] setLoading(false) - Carregamento completo');
      setLoading(false);
    } catch (err) {
      console.error('❌ [TeamContext] ERRO INESPERADO ao carregar teams:', err);
      setLoading(false);
    } finally {
      console.log('🔵 [TeamContext] isLoadingRef = false (finally)');
      isLoadingRef.current = false;
    }
  }, [toast]);

  // Trocar de operação
  const switchTeam = (teamId: string) => {
    const team = availableTeams.find(t => t.team_id === teamId);
    
    if (!team) {
      toast({
        title: "Operação não encontrada",
        variant: "destructive",
      });
      return;
    }

    setCurrentTeam(team);
    localStorage.setItem(CURRENT_TEAM_KEY, teamId);
    
    toast({
      title: "Operação alterada",
      description: `Você está agora em: ${team.team_name}`,
    });
  };

  // Recarregar teams (útil após criar novo team ou ser adicionado a um)
  const refreshTeams = async () => {
    await loadUserTeams();
  };

  // Carregar teams quando o componente montar e quando auth mudar
  useEffect(() => {
    console.log('🟢 [TeamContext] useEffect PRINCIPAL MONTADO/RE-MONTADO');
    let isMounted = true;

    const initializeTeams = async () => {
      console.log('🟢 [TeamContext] initializeTeams INICIOU');
      const { data: { user } } = await supabase.auth.getUser();
      console.log('🟢 [TeamContext] Usuário atual:', user?.email || 'NÃO AUTENTICADO');
      
      if (!isMounted) {
        console.log('⚠️ [TeamContext] Componente desmontado, abortando');
        return;
      }

      if (user) {
        console.log('🟢 [TeamContext] Usuário autenticado, chamando loadUserTeams()');
        await loadUserTeams();
      } else {
        console.log('⚠️ [TeamContext] Usuário não autenticado, resetando estado');
        setAvailableTeams([]);
        setCurrentTeam(null);
        setLoading(false);
      }
    };

    initializeTeams();

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🟢 [TeamContext] onAuthStateChange:', event, session?.user?.email || 'sem sessão');
      
      if (!isMounted) {
        console.log('⚠️ [TeamContext] Componente desmontado, ignorando auth change');
        return;
      }

      if (event === 'SIGNED_IN' && session) {
        console.log('🟢 [TeamContext] SIGNED_IN detectado, carregando teams');
        await loadUserTeams();
      } else if (event === 'SIGNED_OUT') {
        console.log('🟢 [TeamContext] SIGNED_OUT detectado, limpando estado');
        setAvailableTeams([]);
        setCurrentTeam(null);
        localStorage.removeItem(CURRENT_TEAM_KEY);
        setLoading(false);
      }
    });

    return () => {
      console.log('🔴 [TeamContext] useEffect PRINCIPAL DESMONTADO (cleanup)');
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserTeams]);

  // ✅ RECOVERY MECHANISM: Se state foi perdido após F5, tentar recuperar
  useEffect(() => {
    // Só tenta recovery uma vez
    if (recoveryAttemptedRef.current) {
      console.log('⚠️ [TeamContext] Recovery já foi tentado, ignorando');
      return;
    }
    
    // Se não está loading e não tem currentTeam mas tem availableTeams
    if (!loading && !currentTeam && availableTeams.length > 0) {
      const savedTeamId = localStorage.getItem(CURRENT_TEAM_KEY);
      console.log('🔧 [TeamContext] RECOVERY ATIVADO - savedTeamId:', savedTeamId, 'availableTeams:', availableTeams.length);
      
      if (savedTeamId) {
        const savedTeam = availableTeams.find(t => t.team_id === savedTeamId);
        
        if (savedTeam) {
          console.log('✅ [TeamContext] RECOVERY - Team recuperado:', savedTeam.team_name);
          setCurrentTeam(savedTeam);
        } else {
          console.warn('⚠️ [TeamContext] RECOVERY - Team salvo não encontrado, usando primeiro');
          setCurrentTeam(availableTeams[0]);
          localStorage.setItem(CURRENT_TEAM_KEY, availableTeams[0].team_id);
        }
        
        recoveryAttemptedRef.current = true;
      } else {
        console.log('🔧 [TeamContext] RECOVERY - Nenhum team salvo, selecionando primeiro');
        setCurrentTeam(availableTeams[0]);
        localStorage.setItem(CURRENT_TEAM_KEY, availableTeams[0].team_id);
        recoveryAttemptedRef.current = true;
      }
    }
  }, [loading, currentTeam, availableTeams]);

  // Memoizar o value para evitar re-renders desnecessários
  const value = useMemo<TeamContextType>(() => ({
    currentTeam,
    availableTeams,
    loading,
    switchTeam,
    refreshTeams,
  }), [currentTeam, availableTeams, loading, switchTeam, refreshTeams]);

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
