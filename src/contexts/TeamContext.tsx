import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserTeam } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

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
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    console.log('[TeamContext] Effect - authLoading:', authLoading, 'user:', user?.email || 'none');
    
    if (authLoading) {
      console.log('[TeamContext] Waiting for auth...');
      return;
    }

    if (!user) {
      console.log('[TeamContext] No user, clearing state');
      setAvailableTeams([]);
      setCurrentTeam(null);
      setLoading(false);
      return;
    }

    const loadTeams = async () => {
      console.log('[TeamContext] Loading teams for:', user.email);
      setLoading(true);

      try {
        const { data, error } = await supabase.rpc('get_user_teams', {
          user_id_param: user.id,
        });

        if (error) {
          console.error('[TeamContext] Error:', error);
          toast({
            title: "Erro ao carregar operações",
            description: error.message,
            variant: "destructive",
          });
          setAvailableTeams([]);
          setCurrentTeam(null);
          setLoading(false);
          return;
        }

        const teams = ((data || []) as UserTeam[]).map(team => ({
          ...team,
          member_count: normalizeMemberCount(team.member_count),
        }));

        console.log('[TeamContext] Teams loaded:', teams.length);
        setAvailableTeams(teams);

        if (teams.length === 0) {
          console.log('[TeamContext] No teams found');
          setCurrentTeam(null);
          setLoading(false);
          return;
        }

        const savedTeamId = localStorage.getItem(CURRENT_TEAM_KEY);
        const savedTeam = savedTeamId ? teams.find(t => t.team_id === savedTeamId) : null;

        const teamToSelect = savedTeam || teams[0];
        
        console.log('[TeamContext] Selected:', teamToSelect.team_name);
        setCurrentTeam(teamToSelect);
        localStorage.setItem(CURRENT_TEAM_KEY, teamToSelect.team_id);
        setLoading(false);

      } catch (err) {
        console.error('[TeamContext] Unexpected error:', err);
        setAvailableTeams([]);
        setCurrentTeam(null);
        setLoading(false);
        toast({
          title: "Erro ao carregar operações",
          description: err instanceof Error ? err.message : "Erro desconhecido",
          variant: "destructive",
        });
      }
    };

    loadTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const switchTeam = useCallback((teamId: string) => {
    console.log('[TeamContext] Switching to:', teamId);
    
    const team = availableTeams.find(t => t.team_id === teamId);
    
    if (!team) {
      console.error('[TeamContext] Team not found:', teamId);
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
  }, [availableTeams, toast]);

  const refreshTeams = useCallback(async () => {
    console.log('[TeamContext] Refreshing teams');
    
    if (!user) {
      console.log('[TeamContext] Cannot refresh - no user');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('get_user_teams', {
        user_id_param: user.id,
      });

      if (error) {
        console.error('[TeamContext] Refresh error:', error);
        toast({
          title: "Erro ao atualizar operações",
          description: error.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const teams = ((data || []) as UserTeam[]).map(team => ({
        ...team,
        member_count: normalizeMemberCount(team.member_count),
      }));

      console.log('[TeamContext] Refreshed:', teams.length);
      setAvailableTeams(teams);

      if (currentTeam) {
        const stillExists = teams.find(t => t.team_id === currentTeam.team_id);
        if (stillExists) {
          setCurrentTeam(stillExists);
        } else if (teams.length > 0) {
          setCurrentTeam(teams[0]);
          localStorage.setItem(CURRENT_TEAM_KEY, teams[0].team_id);
        } else {
          setCurrentTeam(null);
          localStorage.removeItem(CURRENT_TEAM_KEY);
        }
      } else if (teams.length > 0) {
        setCurrentTeam(teams[0]);
        localStorage.setItem(CURRENT_TEAM_KEY, teams[0].team_id);
      }

      setLoading(false);

    } catch (err) {
      console.error('[TeamContext] Unexpected refresh error:', err);
      setLoading(false);
      toast({
        title: "Erro ao atualizar operações",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  }, [user, currentTeam, toast]);

  useEffect(() => {
    console.log('[TeamContext] Setting up auth listener');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      console.log('[TeamContext] Auth event:', event);
      
      if (event === 'SIGNED_OUT') {
        console.log('[TeamContext] Signed out, clearing');
        setAvailableTeams([]);
        setCurrentTeam(null);
        localStorage.removeItem(CURRENT_TEAM_KEY);
        setLoading(false);
      }
    });

    return () => {
      console.log('[TeamContext] Cleanup listener');
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<TeamContextType>(() => ({
    currentTeam,
    availableTeams,
    loading,
    switchTeam,
    refreshTeams,
  }), [currentTeam, availableTeams, loading, switchTeam, refreshTeams]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeam() {
  const context = useContext(TeamContext);
  
  if (context === undefined) {
    throw new Error('useTeam deve ser usado dentro de um TeamProvider');
  }
  
  return context;
}
