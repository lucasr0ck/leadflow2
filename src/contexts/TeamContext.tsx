import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
  useCallback,
  useRef,
} from 'react';
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

const LEGACY_TEAM_KEY = 'leadflow_current_team_id';
const TEAM_STORAGE_PREFIX = 'leadflow_current_team';
const TEAM_CACHE_PREFIX = 'leadflow_team_cache';
const TEAM_CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

const isBrowser = typeof window !== 'undefined';

const safeStorage = {
  get(key: string) {
    if (!isBrowser) return null;

    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.warn(`[TeamContext] Unable to read ${key} from localStorage`, error);
      return null;
    }
  },
  set(key: string, value: string) {
    if (!isBrowser) return;

    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn(`[TeamContext] Unable to write ${key} to localStorage`, error);
    }
  },
  remove(key: string) {
    if (!isBrowser) return;

    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn(`[TeamContext] Unable to remove ${key} from localStorage`, error);
    }
  },
};

const getStorageKey = (userId: string) => `${TEAM_STORAGE_PREFIX}:${userId}`;
const getCacheKey = (userId: string) => `${TEAM_CACHE_PREFIX}:${userId}`;

const getStoredTeamId = (userId: string | null | undefined) => {
  if (!userId) {
    return safeStorage.get(LEGACY_TEAM_KEY);
  }

  return safeStorage.get(getStorageKey(userId)) ?? safeStorage.get(LEGACY_TEAM_KEY);
};

const storeTeamId = (userId: string | null | undefined, teamId: string) => {
  if (userId) {
    safeStorage.set(getStorageKey(userId), teamId);
  }

  safeStorage.set(LEGACY_TEAM_KEY, teamId);
};

const clearStoredTeamId = (userId: string | null | undefined) => {
  if (userId) {
    safeStorage.remove(getStorageKey(userId));
  }

  safeStorage.remove(LEGACY_TEAM_KEY);
};

interface TeamCacheEntry {
  version: 1;
  updatedAt: number;
  teams: UserTeam[];
}

const readTeamCache = (userId: string): TeamCacheEntry | null => {
  const raw = safeStorage.get(getCacheKey(userId));

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as TeamCacheEntry | null;

    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.teams) || typeof parsed.updatedAt !== 'number') {
      console.warn('[TeamContext] Ignoring malformed team cache entry');
      safeStorage.remove(getCacheKey(userId));
      return null;
    }

    const age = Date.now() - parsed.updatedAt;

    if (age > TEAM_CACHE_TTL_MS) {
      console.log('[TeamContext] Team cache expired, discarding');
      safeStorage.remove(getCacheKey(userId));
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('[TeamContext] Failed to parse team cache entry', error);
    safeStorage.remove(getCacheKey(userId));
    return null;
  }
};

const writeTeamCache = (userId: string, teams: UserTeam[]) => {
  try {
    const payload: TeamCacheEntry = {
      version: 1,
      updatedAt: Date.now(),
      teams,
    };

    safeStorage.set(getCacheKey(userId), JSON.stringify(payload));
  } catch (error) {
    console.warn('[TeamContext] Failed to persist team cache', error);
  }
};

const clearTeamCache = (userId: string) => {
  safeStorage.remove(getCacheKey(userId));
};

const slugify = (value: string) => {
  if (!value) return '';

  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

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

interface NormalizedTeamInput {
  team_id?: string | null;
  id?: string | null;
  team_name?: string | null;
  team_slug?: string | null;
  slug?: string | null;
  description?: string | null;
  role?: string | null;
  is_active?: boolean | null;
  member_count?: unknown;
  joined_at?: string | null;
  created_at?: string | null;
}

const normalizeTeamRecord = (raw: NormalizedTeamInput): UserTeam | null => {
  const teamId = raw.team_id ?? raw.id;

  if (!teamId) {
    console.warn('[TeamContext] Skipping team without ID', raw);
    return null;
  }

  const teamName = typeof raw.team_name === 'string' ? raw.team_name : '';
  const slugSource = raw.team_slug ?? raw.slug ?? teamName;
  const normalizedSlug = slugify(slugSource || teamName);
  const role = raw.role && typeof raw.role === 'string' ? raw.role : 'member';

  return {
    team_id: teamId,
    team_name: teamName,
    team_slug: normalizedSlug,
    description: raw.description ?? null,
    role: role as UserTeam['role'],
    is_active: raw.is_active ?? true,
    member_count: normalizeMemberCount(raw.member_count),
    joined_at: raw.joined_at ?? raw.created_at ?? new Date().toISOString(),
  };
};

const dedupeTeams = (teams: UserTeam[]): UserTeam[] => {
  const map = new Map<string, UserTeam>();

  teams.forEach((team) => {
    const existing = map.get(team.team_id);

    if (!existing) {
      map.set(team.team_id, team);
      return;
    }

    const shouldReplace = existing.role !== 'owner' && team.role === 'owner';
    const memberCount = team.member_count || existing.member_count;

    if (shouldReplace) {
      map.set(team.team_id, { ...team, member_count: memberCount });
    } else if (!existing.member_count && memberCount) {
      map.set(team.team_id, { ...existing, member_count: memberCount });
    }
  });

  return Array.from(map.values());
};

const describeError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === 'string') {
      return message;
    }

    try {
      return JSON.stringify(message);
    } catch (serializationError) {
      console.warn('[TeamContext] Failed to serialize error message', serializationError);
    }
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Erro desconhecido';
};

const fetchTeamsViaRpc = async (userId: string): Promise<UserTeam[]> => {
  console.log('[TeamContext] 🔍 Trying RPC get_user_teams for user:', userId);

  try {
    const { data, error } = await supabase.rpc('get_user_teams', { user_id_param: userId });

    if (error) {
      console.error('[TeamContext] ❌ RPC get_user_teams error:', error);
      return [];
    }

    if (!Array.isArray(data)) {
      console.warn('[TeamContext] ⚠️ RPC returned unexpected payload:', data);
      return [];
    }

    const normalized = data
      .map((team) => normalizeTeamRecord({
        team_id: team.team_id,
        team_name: team.team_name,
        team_slug: team.team_slug,
        description: team.description,
        role: team.role,
        is_active: team.is_active,
        member_count: team.member_count,
        joined_at: team.joined_at,
      }))
      .filter((team): team is UserTeam => team !== null);

    console.log('[TeamContext] ✅ RPC returned teams:', normalized.length);
    return dedupeTeams(normalized);
  } catch (error) {
    console.error('[TeamContext] ❌ RPC get_user_teams failed:', error);
    return [];
  }
};

const fetchTeamsViaFallback = async (userId: string): Promise<UserTeam[]> => {
  console.log('[TeamContext] 🔄 Executing fallback queries...');

  const ownedPromise = supabase
    .from('teams')
    .select('id, team_name, slug, description, is_active, created_at')
    .eq('owner_id', userId);

  const memberPromise = supabase
    .from('team_members')
    .select(`
      team_id,
      role,
      joined_at,
      teams:team_id (
        id,
        team_name,
        slug,
        description,
        is_active,
        created_at
      )
    `)
    .eq('user_id', userId);

  const [ownedResult, memberResult] = await Promise.allSettled([ownedPromise, memberPromise]);

  const errors: Error[] = [];
  let ownedTeams: UserTeam[] = [];
  let memberTeams: UserTeam[] = [];

  if (ownedResult.status === 'fulfilled') {
    const { data, error } = ownedResult.value as { data: any[] | null; error: any };

    if (error) {
      errors.push(error instanceof Error ? error : new Error(describeError(error)));
    } else {
      ownedTeams = (data ?? [])
        .map((team) => normalizeTeamRecord({
          team_id: team.id,
          team_name: team.team_name,
          team_slug: team.slug,
          description: team.description,
          role: 'owner',
          is_active: team.is_active,
          joined_at: team.created_at,
        }))
        .filter((team): team is UserTeam => team !== null);

      console.log('[TeamContext] 🔍 Owned teams fallback result:', ownedTeams.length);
    }
  } else {
    const error = ownedResult.reason instanceof Error
      ? ownedResult.reason
      : new Error(describeError(ownedResult.reason));
    errors.push(error);
  }

  if (memberResult.status === 'fulfilled') {
    const { data, error } = memberResult.value as { data: any[] | null; error: any };

    if (error) {
      errors.push(error instanceof Error ? error : new Error(describeError(error)));
    } else {
      memberTeams = (data ?? [])
        .map((membership) => {
          const teamRecord = Array.isArray(membership.teams) ? membership.teams[0] : membership.teams;

          if (!teamRecord) {
            return null;
          }

          return normalizeTeamRecord({
            team_id: teamRecord.id ?? membership.team_id,
            team_name: teamRecord.team_name,
            team_slug: teamRecord.slug,
            description: teamRecord.description,
            role: membership.role,
            is_active: teamRecord.is_active,
            joined_at: membership.joined_at ?? teamRecord.created_at,
          });
        })
        .filter((team): team is UserTeam => team !== null);

      console.log('[TeamContext] 🔍 team_members fallback result:', memberTeams.length);
    }
  } else {
    const error = memberResult.reason instanceof Error
      ? memberResult.reason
      : new Error(describeError(memberResult.reason));
    errors.push(error);
  }

  const combined = dedupeTeams([...ownedTeams, ...memberTeams]);
  console.log('[TeamContext] ✅ Fallback queries returned teams:', combined.length);

  if (combined.length > 0) {
    return combined;
  }

  if (errors.length > 0) {
    throw errors[0];
  }

  return [];
};

const fetchTeamsForUser = async (userId: string): Promise<UserTeam[]> => {
  const rpcTeams = await fetchTeamsViaRpc(userId);

  if (rpcTeams.length > 0) {
    return rpcTeams;
  }

  return fetchTeamsViaFallback(userId);
};

interface TeamProviderProps {
  children: ReactNode;
}

export function TeamProvider({ children }: TeamProviderProps) {
  const [currentTeam, setCurrentTeam] = useState<UserTeam | null>(null);
  const [availableTeams, setAvailableTeams] = useState<UserTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const availableTeamsRef = useRef<UserTeam[]>([]);
  useEffect(() => {
    availableTeamsRef.current = availableTeams;
  }, [availableTeams]);

  const requestIdRef = useRef(0);
  const emptyToastRef = useRef(false);

  const loadTeams = useCallback(async (options: { silent?: boolean } = {}) => {
    const { silent = false } = options;

    if (!user) {
      return;
    }

    const requestId = ++requestIdRef.current;
    console.log('[TeamContext] Loading teams for:', user.email);
    if (!silent) {
      setLoading(true);
    }

    try {
      const teams = await fetchTeamsForUser(user.id);

      if (requestIdRef.current !== requestId) {
        console.log('[TeamContext] Ignoring outdated teams response');
        return;
      }

      if (teams.length === 0) {
        console.log('[TeamContext] ⚠️ No teams found for user');
        setAvailableTeams([]);
        setCurrentTeam(null);
        clearStoredTeamId(user.id);
        clearTeamCache(user.id);

        if (!emptyToastRef.current) {
          toastRef.current({
            title: 'Nenhuma operação encontrada',
            description: 'Você precisa criar uma operação em Configurações → Gerenciar Operações',
          });
          emptyToastRef.current = true;
        }

        return;
      }

      emptyToastRef.current = false;
      setAvailableTeams(teams);

      const storedTeamId = getStoredTeamId(user.id);
      const selectedTeam = storedTeamId
        ? teams.find((team) => team.team_id === storedTeamId) ?? teams[0]
        : teams[0];

      setCurrentTeam(selectedTeam);
      storeTeamId(user.id, selectedTeam.team_id);
      writeTeamCache(user.id, teams);

      console.log('[TeamContext] ✅ Teams loaded:', {
        total: teams.length,
        selected: selectedTeam.team_name,
      });
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        console.log('[TeamContext] Ignoring outdated error response');
        return;
      }

      console.error('[TeamContext] ❌ Failed to load teams:', error);

      if (availableTeamsRef.current.length === 0) {
        setAvailableTeams([]);
        setCurrentTeam(null);
        clearStoredTeamId(user.id);
      }

      toastRef.current({
        title: 'Erro ao carregar operações',
        description: describeError(error),
        variant: 'destructive',
      });
    } finally {
      if (requestIdRef.current === requestId && !silent) {
        setLoading(false);
      }
    }
  }, [user]);

  const hydrateFromCache = useCallback(() => {
    if (!user) {
      return false;
    }

    const cached = readTeamCache(user.id);

    if (!cached || cached.teams.length === 0) {
      return false;
    }

    const deduped = dedupeTeams(cached.teams);

    if (deduped.length === 0) {
      clearTeamCache(user.id);
      return false;
    }

    const storedTeamId = getStoredTeamId(user.id);
    const selectedTeam = storedTeamId
      ? deduped.find((team) => team.team_id === storedTeamId) ?? deduped[0]
      : deduped[0];

    setAvailableTeams(deduped);
    setCurrentTeam(selectedTeam);
    setLoading(false);

    const ageSeconds = Math.round((Date.now() - cached.updatedAt) / 1000);
    console.log('[TeamContext] ♻️ Hydrated teams from cache:', {
      total: deduped.length,
      selected: selectedTeam.team_name,
      ageSeconds,
    });

    return true;
  }, [user]);

  useEffect(() => {
    console.log('[TeamContext] Effect - authLoading:', authLoading, 'user:', user?.email || 'none');

    if (authLoading) {
      console.log('[TeamContext] Waiting for auth...');
      return;
    }

    requestIdRef.current += 1;

    if (!user) {
      console.log('[TeamContext] No user, clearing state');
      setAvailableTeams([]);
      setCurrentTeam(null);
      setLoading(false);
      clearStoredTeamId(null);
      emptyToastRef.current = false;
      return;
    }

    emptyToastRef.current = false;
    const hydrated = hydrateFromCache();
    loadTeams({ silent: hydrated });
  }, [user, authLoading, loadTeams, hydrateFromCache]);

  const switchTeam = useCallback((teamId: string) => {
    const team = availableTeams.find((t) => t.team_id === teamId);

    if (!team) {
      console.error('[TeamContext] Team not found:', teamId);
      toastRef.current({
        title: 'Operação não encontrada',
        variant: 'destructive',
      });
      return;
    }

    if (currentTeam?.team_id === teamId) {
      return;
    }

    setCurrentTeam(team);
    storeTeamId(user?.id, team.team_id);

    toastRef.current({
      title: 'Operação alterada',
      description: `Você está agora em: ${team.team_name}`,
    });
  }, [availableTeams, currentTeam?.team_id, user?.id]);

  const refreshTeams = useCallback(async () => {
    if (!user) {
      console.log('[TeamContext] Cannot refresh - no user');
      return;
    }

    await loadTeams();
  }, [user, loadTeams]);

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
