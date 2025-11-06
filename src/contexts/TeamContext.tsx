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
const normalizeTeamRecord = (
  raw: Partial<UserTeam> & {
    team_id?: string | null;
    id?: string | null;
    slug?: string | null;
    team_slug?: string | null;
    created_at?: string | null;
  },
): UserTeam | null => {
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

const mapRpcTeams = (rpcTeams: any[]): UserTeam[] =>
  rpcTeams
    .map((team) => normalizeTeamRecord({
      team_id: team.team_id ?? team.id,
      team_name: team.team_name,
      team_slug: team.team_slug,
      description: team.description ?? null,
      role: team.role,
      is_active: team.is_active,
      member_count: team.member_count,
      joined_at: team.joined_at ?? team.created_at,
    }))
    .filter((team): team is UserTeam => team !== null);

const getErrorMessage = (error: unknown) => {
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
const withTimeout = async <T,>(
  promiseFactory: () => Promise<T>,
  timeoutMs: number,
  context: string,
): Promise<WithTimeoutResult<T>> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutError = new Error(`${context} timed out after ${timeoutMs}ms`);
  timeoutError.name = 'TimeoutError';

  const sourcePromise = promiseFactory();

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(timeoutError), timeoutMs);
  });

  try {
    const value = await Promise.race([sourcePromise, timeoutPromise]);
    return {
      success: true,
      value: value as T,
      timedOut: false,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const timedOut = err.name === 'TimeoutError' || err.message.includes('timed out');

    if (timedOut) {
      sourcePromise
        .then((lateValue) => {
          console.warn(`[TeamContext] ${context} resolved after timeout, ignoring result`, lateValue);
        })
        .catch((lateError) => {
          console.warn(`[TeamContext] ${context} failed after timeout`, lateError);
        });
    }

    return {
      success: false,
      error: err,
      timedOut,
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const fetchOwnedTeams = async (userId: string): Promise<UserTeam[]> => {
  const result = await withTimeout(
    () =>
      supabase
        .from('teams')
        .select('id, team_name, slug, description, is_active, created_at')
        .eq('owner_id', userId),
    FALLBACK_TIMEOUT_MS,
    'fetchOwnedTeams',
  );

  if (!result.success) {
    throw result.error ?? new Error('Erro ao buscar operações do usuário');
  }

  const { data, error } = result.value as { data: any[] | null; error: any };

  if (error) {
    throw error;
  }

  const teams = (data ?? [])
    .map((team) =>
      normalizeTeamRecord({
        team_id: team.id,
        team_name: team.team_name,
        team_slug: team.slug,
        description: team.description ?? null,
        role: 'owner',
        is_active: team.is_active,
        joined_at: team.created_at,
      }),
    )
    .filter((team): team is UserTeam => team !== null);

  console.log('[TeamContext] 🔍 Owned teams fallback result:', {
    dataLength: teams.length,
  });

  return teams;
};

const fetchMemberTeams = async (userId: string): Promise<UserTeam[]> => {
  const result = await withTimeout(
    () =>
      supabase
        .from('team_members')
        .select(
          `
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
          `,
        )
        .eq('user_id', userId),
    FALLBACK_TIMEOUT_MS,
    'fetchMemberTeams',
  );

  if (!result.success) {
    throw result.error ?? new Error('Erro ao buscar operações compartilhadas');
  }

  const { data, error } = result.value as { data: any[] | null; error: any };

  if (error) {
    throw error;
  }

  const teams = (data ?? [])
    .map((membership) => {
      const teamRecord = Array.isArray(membership.teams)
        ? membership.teams[0]
        : membership.teams;

      if (!teamRecord) {
        return null;
      }

      return normalizeTeamRecord({
        team_id: teamRecord.id ?? membership.team_id,
        team_name: teamRecord.team_name,
        team_slug: teamRecord.slug,
        description: teamRecord.description ?? null,
        role: membership.role,
        is_active: teamRecord.is_active,
        joined_at: membership.joined_at ?? teamRecord.created_at,
      });
    })
    .filter((team): team is UserTeam => team !== null);

  console.log('[TeamContext] 🔍 team_members fallback result:', {
    dataLength: teams.length,
  });

  return teams;
};
const readTeamCacheStore = (): TeamCacheStore => {
  const raw = safeStorage.get(TEAM_CACHE_KEY);

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed === 'object') {
      return parsed as TeamCacheStore;
    }
  } catch (error) {
    console.warn('[TeamContext] Failed to parse team cache', error);
  }

  safeStorage.remove(TEAM_CACHE_KEY);
  return {};
};

const writeTeamCacheStore = (store: TeamCacheStore) => {
  safeStorage.set(TEAM_CACHE_KEY, JSON.stringify(store));
};

const getCachedTeamsForUser = (userId: string): TeamCacheEntry | null => {
  const store = readTeamCacheStore();
  const entry = store[userId];

  if (!entry) {
    return null;
  }

  const isExpired = Date.now() - entry.updatedAt > TEAM_CACHE_TTL;

  if (isExpired) {
    console.log('[TeamContext] Cached team snapshot expired, discarding');
    delete store[userId];
    writeTeamCacheStore(store);
    return null;
  }

  return entry;
};

const setCachedTeamsForUser = (entry: TeamCacheEntry) => {
  const store = readTeamCacheStore();
  store[entry.userId] = entry;
  writeTeamCacheStore(store);
};

const clearCachedTeamsForUser = (userId: string) => {
  const store = readTeamCacheStore();

  if (store[userId]) {
    delete store[userId];
    writeTeamCacheStore(store);
  }
};

const fetchTeamsData = async (userId: string): Promise<FetchTeamsResult> => {
  console.log('[TeamContext] 🔍 Trying RPC get_user_teams for user:', userId);

  let lastRpcError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RPC_ATTEMPTS; attempt += 1) {
    const rpcResult = await withTimeout(
      () => supabase.rpc('get_user_teams', { user_id_param: userId }),
      RPC_TIMEOUT_MS,
      `get_user_teams (attempt ${attempt})`,
    );

    if (rpcResult.success) {
      const { data, error } = rpcResult.value as { data: any; error: any };

      if (error) {
        lastRpcError = error instanceof Error ? error : new Error(getErrorMessage(error));
        console.error(`[TeamContext] ❌ RPC get_user_teams error (attempt ${attempt}):`, error);
        continue;
      }

      if (Array.isArray(data)) {
        const normalized = mergeAndNormalizeTeams(mapRpcTeams(data));
        console.log('[TeamContext] ✅ RPC returned teams:', normalized.length);
        return {
          teams: normalized,
          source: normalized.length > 0 ? 'rpc' : 'empty',
        };
      }

      console.warn('[TeamContext] ⚠️ RPC returned unexpected payload:', data);
      return {
        teams: [],
        source: 'empty',
      };
    }

    lastRpcError = rpcResult.error ?? new Error('RPC request failed');

    if (rpcResult.timedOut) {
      console.warn(`[TeamContext] ⚠️ RPC attempt ${attempt} timed out after ${RPC_TIMEOUT_MS}ms`);
      continue;
    }

    console.error(`[TeamContext] ❌ RPC attempt ${attempt} failed:`, rpcResult.error);
    break;
  }

  console.log('[TeamContext] 🔄 Executing fallback queries...');

  const fallbackResults = await Promise.allSettled([
    fetchOwnedTeams(userId),
    fetchMemberTeams(userId),
  ]);

  const fallbackTeams: UserTeam[] = [];
  const fallbackErrors: Error[] = [];

  fallbackResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      fallbackTeams.push(...result.value);
    } else {
      const error = result.reason instanceof Error
        ? result.reason
        : new Error(getErrorMessage(result.reason));
      fallbackErrors.push(error);
      console.error(`[TeamContext] ❌ Fallback query ${index === 0 ? 'owned teams' : 'team_members'} failed:`, error);
    }
  });

  if (fallbackTeams.length > 0) {
    const normalized = mergeAndNormalizeTeams(fallbackTeams);
    console.log('[TeamContext] ✅ Fallback queries returned teams:', normalized.length);
    return {
      teams: normalized,
      source: 'fallback',
    };
  }

  if (fallbackErrors.length > 0) {
    throw fallbackErrors[0];
  }

  if (lastRpcError) {
    console.warn('[TeamContext] RPC attempts failed without fallback data:', lastRpcError);
  } else {
    console.warn('[TeamContext] No teams returned from Supabase');
  }

  return {
    teams: [],
    source: 'empty',
  };
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
  const isFetchingRef = useRef(false);
  const hasHydratedFromCacheRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const emptyToastRef = useRef(false);

  const persistTeamSnapshot = useCallback((teams: UserTeam[], selected: UserTeam | null) => {
    if (!user) {
      return;
    }

    const sanitizedTeams = teams
      .map((team) => normalizeTeamRecord(team))
      .filter((team): team is UserTeam => team !== null);

    setCachedTeamsForUser({
      userId: user.id,
      email: user.email,
      availableTeams: sanitizedTeams,
      currentTeamId: selected?.team_id ?? null,
      updatedAt: Date.now(),
    });
  }, [user]);

  const applyTeams = useCallback((teams: UserTeam[], options: ApplyTeamsOptions = {}) => {
    const normalizedTeams = teams
      .map((team) => normalizeTeamRecord(team))
      .filter((team): team is UserTeam => team !== null);

    console.log('[TeamContext] Applying teams:', {
      count: normalizedTeams.length,
      reason: options.reason,
    });

    setAvailableTeams(normalizedTeams);

    if (normalizedTeams.length === 0) {
      setCurrentTeam(null);
      safeStorage.remove(CURRENT_TEAM_KEY);

      if (!options.skipPersistence) {
        persistTeamSnapshot([], null);
      }

      return null;
    }

    const storedTeamId = options.preferredTeamId ?? safeStorage.get(CURRENT_TEAM_KEY);
    const selectedTeam = storedTeamId
      ? normalizedTeams.find(team => team.team_id === storedTeamId) ?? normalizedTeams[0]
      : normalizedTeams[0];

    setCurrentTeam(selectedTeam);
    safeStorage.set(CURRENT_TEAM_KEY, selectedTeam.team_id);

    if (!options.skipPersistence) {
      persistTeamSnapshot(normalizedTeams, selectedTeam);
    }

    return selectedTeam;
  }, [persistTeamSnapshot]);

  const loadTeams = useCallback(async (options: LoadTeamsOptions = {}) => {
    if (!user) {
      console.log('[TeamContext] Skipping loadTeams - no user');
      return;
    }

    if (isFetchingRef.current) {
      console.log('[TeamContext] Skipping loadTeams - already in progress');
      return;
    }

    isFetchingRef.current = true;

    if (!options.hasCachedData) {
      setLoading(true);
    }

    try {
      const result = await fetchTeamsData(user.id);

      if (result.teams.length === 0) {
        applyTeams([], { preferredTeamId: null, reason: result.source });

        if (!emptyToastRef.current) {
          toastRef.current({
            title: 'Nenhuma operação encontrada',
            description: 'Você precisa criar uma operação em Configurações → Gerenciar Operações',
          });
          emptyToastRef.current = true;
        }
      } else {
        emptyToastRef.current = false;
        applyTeams(result.teams, {
          preferredTeamId: options.preferredTeamId ?? undefined,
          reason: result.source,
        });
      }
    } catch (error) {
      console.error('[TeamContext] ❌ Failed to load teams:', error);

      if (!options.hasCachedData) {
        setAvailableTeams([]);
        setCurrentTeam(null);
      }

      toastRef.current({
        title: 'Erro ao carregar operações',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [user, applyTeams]);
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
      safeStorage.remove(CURRENT_TEAM_KEY);

      if (lastUserIdRef.current) {
        clearCachedTeamsForUser(lastUserIdRef.current);
      }

      lastUserIdRef.current = null;
      hasHydratedFromCacheRef.current = false;
      emptyToastRef.current = false;
      return;
    }

    lastUserIdRef.current = user.id;

    let hydrated = false;

    if (!hasHydratedFromCacheRef.current) {
      const cached = getCachedTeamsForUser(user.id);

      if (cached) {
        console.log('[TeamContext] ♻️ Hydrating teams from cache:', cached.availableTeams.length);
        hydrated = cached.availableTeams.length > 0;
        applyTeams(cached.availableTeams, {
          preferredTeamId: cached.currentTeamId,
          skipPersistence: true,
          reason: 'cache-hydration',
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

        if (hydrated) {
          setLoading(false);
        }
      }

      hasHydratedFromCacheRef.current = true;
    }

    loadTeams({
      hasCachedData: hydrated,
      preferredTeamId: safeStorage.get(CURRENT_TEAM_KEY),
      reason: hydrated ? 'refresh-after-cache' : 'initial-load',
    });
  }, [user, authLoading, applyTeams, loadTeams]);

  const switchTeam = useCallback((teamId: string) => {
    console.log('[TeamContext] Switching to:', teamId);

    const team = availableTeams.find(t => t.team_id === teamId);

    if (!team) {
      console.error('[TeamContext] Team not found:', teamId);
      toastRef.current({
        title: 'Operação não encontrada',
        variant: 'destructive',
      });
    } finally {
      if (requestIdRef.current === requestId && !silent) {
        setLoading(false);
      }
    }
  }, [user]);

  const hydrateFromCache = useCallback(() => {
    setCurrentTeam(team);
    safeStorage.set(CURRENT_TEAM_KEY, teamId);
    persistTeamSnapshot(availableTeams, team);

    toastRef.current({
      title: 'Operação alterada',
      description: `Você está agora em: ${team.team_name}`,
    });
  }, [availableTeams, persistTeamSnapshot]);

  const refreshTeams = useCallback(async () => {
    console.log('[TeamContext] Refreshing teams');

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
    await loadTeams({
      hasCachedData: availableTeams.length > 0,
      preferredTeamId: currentTeam?.team_id ?? safeStorage.get(CURRENT_TEAM_KEY),
      reason: 'manual-refresh',
    });
  }, [user, availableTeams.length, currentTeam?.team_id, loadTeams]);

  useEffect(() => {
    console.log('[TeamContext] Setting up auth listener');

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      console.log('[TeamContext] Auth event:', event);

      if (event === 'SIGNED_OUT') {
        console.log('[TeamContext] Signed out, clearing');
        setAvailableTeams([]);
        setCurrentTeam(null);
        safeStorage.remove(CURRENT_TEAM_KEY);

        if (lastUserIdRef.current) {
          clearCachedTeamsForUser(lastUserIdRef.current);
        }

        lastUserIdRef.current = null;
        hasHydratedFromCacheRef.current = false;
        emptyToastRef.current = false;
        setLoading(false);
      }
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
