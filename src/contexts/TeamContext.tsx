import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback, useRef } from 'react';
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
  
  // Use ref to avoid toast being in dependencies
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

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
      console.log('[TeamContext] User ID:', user.id);
      setLoading(true);

      try {
        console.log('[TeamContext] 🔍 Fetching teams with direct query...');
        
        // 🔥 STRATEGY 1: Try to get teams where user is owner (most common case)
        console.log('[TeamContext] 🔍 Trying teams where user is owner...');
        const { data: ownedTeams, error: ownedError } = await supabase
          .from('teams')
          .select('id, team_name, owner_id, created_at')
          .eq('owner_id', user.id);

        console.log('[TeamContext] 🔍 Owned teams result:', { 
          data: ownedTeams, 
          error: ownedError,
          dataLength: ownedTeams?.length,
          dataIsArray: Array.isArray(ownedTeams),
          dataType: typeof ownedTeams
        });

        if (ownedError) {
          console.error('[TeamContext] ❌ Error fetching owned teams:', ownedError);
          toastRef.current({
            title: "Erro ao carregar operações",
            description: ownedError.message,
            variant: "destructive",
          });
        }

        if (ownedTeams && ownedTeams.length > 0) {
          // User owns teams! Use them directly
          console.log('[TeamContext] ✅ Found', ownedTeams.length, 'owned teams');
          
          const teams = ownedTeams.map(team => ({
            team_id: team.id,
            team_name: team.team_name,
            team_slug: team.team_name?.toLowerCase().replace(/\s+/g, '-') || '',
            description: null,
            role: 'owner' as const,
            is_active: true,
            member_count: 0,
            joined_at: team.created_at,
          }));

          console.log('[TeamContext] Teams loaded:', teams.length);
          setAvailableTeams(teams);

          const savedTeamId = localStorage.getItem(CURRENT_TEAM_KEY);
          const savedTeam = savedTeamId ? teams.find(t => t.team_id === savedTeamId) : null;
          const teamToSelect = savedTeam || teams[0];
          
          console.log('[TeamContext] Selected:', teamToSelect.team_name);
          setCurrentTeam(teamToSelect);
          localStorage.setItem(CURRENT_TEAM_KEY, teamToSelect.team_id);
          setLoading(false);
          return;
        }

        // 🔥 STRATEGY 2: Try team_members with timeout (if user is not owner)
        console.log('[TeamContext] 🔍 No owned teams, trying team_members...');
        const queryPromise = supabase
          .from('team_members')
          .select(`
            team_id,
            role,
            teams:team_id (
              id,
              team_name,
              owner_id,
              created_at
            )
          `)
          .eq('user_id', user.id);

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Query timeout after 5 seconds')), 5000);
        });

        const { data: teamMembersData, error: teamMembersError } = await Promise.race([
          queryPromise,
          timeoutPromise
        ]) as any;

        console.log('[TeamContext] 🔍 Direct Query Response:');
        console.log('[TeamContext] - Data:', teamMembersData);
        console.log('[TeamContext] - Error:', teamMembersError);

        if (teamMembersError) {
          console.error('[TeamContext] ❌ Query Error:', {
            code: teamMembersError.code,
            message: teamMembersError.message,
            details: teamMembersError.details,
            hint: teamMembersError.hint,
          });
          toastRef.current({
            title: "Erro ao carregar operações",
            description: teamMembersError.message,
            variant: "destructive",
          });
          setAvailableTeams([]);
          setCurrentTeam(null);
          setLoading(false);
          return;
        }

        // Transform data to UserTeam format
        const teams = (teamMembersData || [])
          .filter(tm => tm.teams) // Filter out null teams
          .map(tm => {
            const team = Array.isArray(tm.teams) ? tm.teams[0] : tm.teams;
            return {
              team_id: team.id,
              team_name: team.team_name,
              team_slug: team.team_name?.toLowerCase().replace(/\s+/g, '-') || '',
              description: null,
              role: tm.role,
              is_active: true,
              member_count: 0,
              joined_at: team.created_at,
            } as UserTeam;
          });

        console.log('[TeamContext] Teams loaded:', teams.length);
        setAvailableTeams(teams);

        if (teams.length === 0) {
          console.log('[TeamContext] ⚠️ No teams found for user');
          setCurrentTeam(null);
          setLoading(false);
          toastRef.current({
            title: "Nenhuma operação encontrada",
            description: "Você precisa criar uma operação em Configurações → Gerenciar Operações",
            variant: "default",
          });
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
        toastRef.current({
          title: "Erro ao carregar operações",
          description: err instanceof Error ? err.message : "Erro desconhecido",
          variant: "destructive",
        });
      }
    };

    loadTeams();
  }, [user, authLoading]);

  const switchTeam = useCallback((teamId: string) => {
    console.log('[TeamContext] Switching to:', teamId);
    
    const team = availableTeams.find(t => t.team_id === teamId);
    
    if (!team) {
      console.error('[TeamContext] Team not found:', teamId);
      toastRef.current({
        title: "Operação não encontrada",
        variant: "destructive",
      });
      return;
    }

    setCurrentTeam(team);
    localStorage.setItem(CURRENT_TEAM_KEY, teamId);
    
    toastRef.current({
      title: "Operação alterada",
      description: `Você está agora em: ${team.team_name}`,
    });
  }, [availableTeams]);

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
        toastRef.current({
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
      toastRef.current({
        title: "Erro ao atualizar operações",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  }, [user, currentTeam]);

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
