import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const WAIT_FOR_SESSION_TIMEOUT_MS = 2000;
const POLL_INTERVAL_MS = 200;
const WAIT_FOR_SESSION_TIMEOUT_MS = 5000;
let pendingSessionPromise: Promise<Session | null> | null = null;

/**
 * Ensures that a Supabase session exists before performing authenticated requests.
 * This helps after hard reloads where the auth state may take a short time to hydrate
 * from localStorage, which previously caused RLS-protected queries to return empty sets.
 */
export async function ensureSupabaseSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();

  if (data.session) {
    return data.session;
  }

  if (!pendingSessionPromise) {
    pendingSessionPromise = new Promise<Session | null>((resolve) => {
      let settled = false;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let pollId: ReturnType<typeof setInterval> | undefined;
      let activeSubscription: { unsubscribe: () => void } | null = null;
      let polling = false;

      const finish = (session: Session | null) => {
        if (settled) {
          return;
        }

      let activeSubscription: { unsubscribe: () => void } | null = null;

      const finish = (session: Session | null) => {
        if (settled) return;
        settled = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (pollId) {
          clearInterval(pollId);
        }
        activeSubscription?.unsubscribe();
        pendingSessionPromise = null;
        resolve(session);
      };

      const tryGetSession = async () => {
        if (polling) {
          return;
        }

        polling = true;
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            finish(data.session);
          }
        } catch (error) {
          console.warn('[ensureSupabaseSession] Failed to poll for session', error);
        } finally {
          polling = false;
        }
      };

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
          finish(session);
        }
      });

      activeSubscription = subscription;

      timeoutId = setTimeout(() => {
        finish(null);
      }, WAIT_FOR_SESSION_TIMEOUT_MS);

      pollId = setInterval(() => {
        void tryGetSession();
      }, POLL_INTERVAL_MS);

      void tryGetSession();
    });
  }

  return pendingSessionPromise;
}
