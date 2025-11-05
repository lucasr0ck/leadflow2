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
  const hasInitializedRef = useRef(false);
  const recoveryAttemptedRef = useRef(false);

  // Carregar teams do usuário
  const loadUserTeams = useCallback(async () => {
    // Prevenir chamadas simultâneas
    if (isLoadingRef.current) {
      console.log('TeamContext: Já está carregando, ignorando chamada duplicada');
      return;
    }

    isLoadingRef.current = true;
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setAvailableTeams([]);
        setCurrentTeam(null);
        setLoading(false);
        return;
      }

      // Chamar função do Supabase que retorna os teams do usuário
      const { data, error } = await supabase.rpc('get_user_teams');

      if (error) {
        console.error('Erro ao carregar teams:', error);
        
        // Se a função não existe, significa que as migrations não foram executadas
        if (error.message?.includes('function') || error.message?.includes('does not exist')) {
          toast({
            title: "⚠️ Migrations não executadas",
            description: "Execute as migrations do Supabase antes de usar a aplicação. Veja DEPLOY_EASYPANEL.md",
            variant: "destructive",
          });
        } else {
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
      setAvailableTeams(teams);

      // Se não tem teams, usuário precisa criar um
      if (teams.length === 0) {
        setCurrentTeam(null);
        setLoading(false);
        return;
      }

      // Tentar restaurar team salvo no localStorage
      const savedTeamId = localStorage.getItem(CURRENT_TEAM_KEY);
      const savedTeam = teams.find(t => t.team_id === savedTeamId);

      if (savedTeam) {
        setCurrentTeam(savedTeam);
      } else {
        // Se não tem team salvo, selecionar o primeiro
        setCurrentTeam(teams[0]);
        localStorage.setItem(CURRENT_TEAM_KEY, teams[0].team_id);
      }

      setLoading(false);
    } catch (err) {
      console.error('Erro inesperado ao carregar teams:', err);
      setLoading(false);
    } finally {
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
    console.log('TeamContext: useEffect running, hasInitialized:', hasInitializedRef.current);
    
    // ✅ FIX CRÍTICO: Não use hasInitializedRef para prevenir execução
    // Deixe o useEffect executar normalmente no mount
    // O isLoadingRef já previne chamadas duplicadas
    
    console.log('TeamContext: Inicializando/Re-inicializando...');
    
    // Carregar teams inicialmente
    loadUserTeams();

    // Listener para mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      console.log('TeamContext: Auth mudou ->', event);
      
      if (event === 'SIGNED_IN') {
        // Pequeno delay para garantir que o user está disponível
        setTimeout(() => loadUserTeams(), 150);
      } else if (event === 'SIGNED_OUT') {
        isLoadingRef.current = false;
        setCurrentTeam(null);
        setAvailableTeams([]);
        setLoading(false);
        localStorage.removeItem(CURRENT_TEAM_KEY);
      }
    });

    return () => {
      console.log('TeamContext: Limpando subscription');
      subscription.unsubscribe();
      // ✅ NÃO resete hasInitializedRef - causa o bug de F5
    };
  }, []); // Array vazio - executa no mount e cria subscription

  // ✅ RECOVERY MECHANISM: Se state foi perdido após F5, tentar recuperar
  useEffect(() => {
    // Só tenta recovery uma vez
    if (recoveryAttemptedRef.current) return;
    
    // Se não está loading e não tem currentTeam mas tem savedTeamId
    if (!loading && !currentTeam && availableTeams.length > 0) {
      const savedTeamId = localStorage.getItem(CURRENT_TEAM_KEY);
      
      if (savedTeamId) {
        console.log('TeamContext: RECOVERY - Detectado state perdido, recuperando team:', savedTeamId);
        const savedTeam = availableTeams.find(t => t.team_id === savedTeamId);
        
        if (savedTeam) {
          setCurrentTeam(savedTeam);
          console.log('TeamContext: RECOVERY - Team recuperado:', savedTeam.team_name);
        } else {
          console.warn('TeamContext: RECOVERY - Team salvo não encontrado, usando primeiro');
          setCurrentTeam(availableTeams[0]);
          localStorage.setItem(CURRENT_TEAM_KEY, availableTeams[0].team_id);
        }
        
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
