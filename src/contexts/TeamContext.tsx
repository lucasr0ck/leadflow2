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

    const selectInitialTeam = (teams: UserTeam[]) => {
      if (teams.length === 0) {
        console.log('[TeamContext] ⚠️ No teams found for user');
        setAvailableTeams([]);
        setCurrentTeam(null);
        setLoading(false);
        toastRef.current({
          title: "Nenhuma operação encontrada",
          description: "Você precisa criar uma operação em Configurações → Gerenciar Operações",
          variant: "default",
        });
        return;
      }

      setAvailableTeams(teams);

      const savedTeamId = localStorage.getItem(CURRENT_TEAM_KEY);
      const savedTeam = savedTeamId ? teams.find(t => t.team_id === savedTeamId) : null;
      const teamToSelect = savedTeam || teams[0];

      console.log('[TeamContext] Selected:', teamToSelect.team_name);
      setCurrentTeam(teamToSelect);
      localStorage.setItem(CURRENT_TEAM_KEY, teamToSelect.team_id);
      setLoading(false);
    };

    const fetchOwnedTeams = async (): Promise<UserTeam[]> => {
      console.log('[TeamContext] 🔍 Fetching owned teams as fallback...');

      const { data: ownedTeams, error } = await supabase
        .from('teams')
        .select('id, team_name, owner_id, created_at')
        .eq('owner_id', user.id);

      console.log('[TeamContext] 🔍 Owned teams fallback result:', {
        dataLength: ownedTeams?.length,
        hasError: !!error,
      });

      if (error) {
        console.error('[TeamContext] ❌ Error fetching owned teams fallback:', error);
        toastRef.current({
          title: "Erro ao carregar operações",
          description: error.message,
          variant: "destructive",
        });
        return [];
      }

      if (!ownedTeams || ownedTeams.length === 0) {
        return [];
      }

      return ownedTeams.map(team => ({
        team_id: team.id,
        team_name: team.team_name,
        team_slug: team.team_name?.toLowerCase().replace(/\s+/g, '-') || '',
        description: null,
        role: 'owner' as const,
        is_active: true,
        member_count: 0,
        joined_at: team.created_at,
      }));
    };

    const fetchTeamsFromMembership = async (): Promise<UserTeam[]> => {
      console.log('[TeamContext] 🔍 Fetching teams from team_members fallback...');

      const { data, error } = await supabase
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

      console.log('[TeamContext] 🔍 team_members fallback result:', {
        dataLength: data?.length,
        hasError: !!error,
      });

      if (error) {
        console.error('[TeamContext] ❌ team_members fallback error:', error);
        toastRef.current({
          title: "Erro ao carregar operações",
          description: error.message,
          variant: "destructive",
        });
        return [];
      }

      return (data || [])
        .map(tm => {
          const team = Array.isArray(tm.teams) ? tm.teams[0] : tm.teams;

          if (!team) {
            return null;
          }

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
        })
        .filter((team): team is UserTeam => team !== null);
    };

    const mapRpcTeams = (rpcTeams: any[]): UserTeam[] => {
      if (!Array.isArray(rpcTeams)) {
        return [];
      }

      return rpcTeams.map((team) => ({
        team_id: team.team_id ?? team.id,
        team_name: team.team_name ?? '',
        team_slug: team.team_slug || team.team_name?.toLowerCase().replace(/\s+/g, '-') || '',
        description: team.description ?? null,
        role: (team.role ?? 'member') as UserTeam['role'],
        is_active: team.is_active ?? true,
        member_count: normalizeMemberCount(team.member_count),
        joined_at: team.joined_at ?? team.created_at ?? new Date().toISOString(),
      }));
    };

    const mergeAndNormalizeTeams = (teams: UserTeam[]): UserTeam[] => {
      const map = new Map<string, UserTeam>();

      teams.forEach(team => {
        if (!map.has(team.team_id)) {
          map.set(team.team_id, {
            ...team,
            member_count: normalizeMemberCount(team.member_count),
          });
        }
      });

      const result = Array.from(map.values());

      console.log('[TeamContext] ✅ Merged teams count:', result.length);
      return result;
    };

    const loadTeams = async () => {
      console.log('[TeamContext] Loading teams for:', user.email);
      console.log('[TeamContext] User ID:', user.id);
      setLoading(true);

      try {
        console.log('[TeamContext] 🔍 Trying RPC get_user_teams...');
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_teams', {
          user_id_param: user.id,
        });

        if (rpcError) {
          console.error('[TeamContext] ❌ RPC get_user_teams error:', rpcError);
        } else {
          console.log('[TeamContext] 🔍 RPC data length:', Array.isArray(rpcData) ? rpcData.length : 'not array');

          if (Array.isArray(rpcData) && rpcData.length > 0) {
            const teams = mergeAndNormalizeTeams(mapRpcTeams(rpcData));
            selectInitialTeam(teams);
            return;
          }

          console.log('[TeamContext] ⚠️ RPC returned empty list, falling back to direct queries');
        }

        console.log('[TeamContext] 🔄 Executing fallback queries...');
        const [ownedTeams, memberTeams] = await Promise.all([
          fetchOwnedTeams(),
          fetchTeamsFromMembership(),
        ]);

        const mergedTeams = mergeAndNormalizeTeams([...ownedTeams, ...memberTeams]);
        selectInitialTeam(mergedTeams);
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
