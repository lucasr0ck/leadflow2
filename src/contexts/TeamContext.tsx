import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

  // Carregar teams do usuário
  const loadUserTeams = async () => {
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
        toast({
          title: "Erro ao carregar operações",
          description: error.message,
          variant: "destructive",
        });
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
    }
  };

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

  // Carregar teams quando o componente montar
  useEffect(() => {
    loadUserTeams();
  }, []);

  // Recarregar quando o usuário mudar (login/logout)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        loadUserTeams();
      } else if (event === 'SIGNED_OUT') {
        setCurrentTeam(null);
        setAvailableTeams([]);
        localStorage.removeItem(CURRENT_TEAM_KEY);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value: TeamContextType = {
    currentTeam,
    availableTeams,
    loading,
    switchTeam,
    refreshTeams,
  };

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
