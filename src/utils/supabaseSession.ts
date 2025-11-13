import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Give the auth system enough time to hydrate from storage after hard reloads.
// Some environments (slow disks, heavy CPU in preview instances, CI-built bundles)
// can take longer than 5s to restore session from localStorage. Increase to 15s
// to reduce race conditions on hard reloads.
const WAIT_FOR_SESSION_TIMEOUT_MS = 15000;
const POLL_INTERVAL_MS = 300;
let pendingSessionPromise: Promise<Session | null> | null = null;

/**
 * Ensures that a Supabase session exists before performing authenticated requests.
 * This helps after hard reloads where the auth state may take a short time to hydrate
 * from localStorage, which previously caused RLS-protected queries to return empty sets.
 */
export async function ensureSupabaseSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();

  if (data.session) {
    console.debug('[ensureSupabaseSession] Session already available');
    return data.session;
  }

  if (!pendingSessionPromise) {
    console.debug('[ensureSupabaseSession] Waiting for session (will wait up to', WAIT_FOR_SESSION_TIMEOUT_MS, 'ms)');
    pendingSessionPromise = new Promise<Session | null>((resolve) => {
      let settled = false;
      // eslint-disable-next-line prefer-const
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      // eslint-disable-next-line prefer-const
      let pollId: ReturnType<typeof setInterval> | undefined;
      let activeSubscription: { unsubscribe: () => void } | null = null;
      let polling = false;

      const finish = (session: Session | null) => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (pollId) clearInterval(pollId);
        try { activeSubscription?.unsubscribe(); } catch (e) { /* ignore */ }
        pendingSessionPromise = null;
        if (session) console.debug('[ensureSupabaseSession] Session resolved via listener/poll');
        else console.debug('[ensureSupabaseSession] Session wait timed out without session');
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
          } else {
            // debug low-volume poll
            console.debug('[ensureSupabaseSession] Polling for session: still none');
          }
        } catch (error) {
          console.warn('[ensureSupabaseSession] Failed to poll for session', error);
        } finally {
          polling = false;
        }
      };

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.debug('[ensureSupabaseSession] onAuthStateChange event:', event, 'session:', !!session);
        if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
          finish(session);
        }
      });

      activeSubscription = subscription;

      timeoutId = setTimeout(() => {
        // timed out waiting for session
        finish(null);
      }, WAIT_FOR_SESSION_TIMEOUT_MS);

      pollId = setInterval(() => {
        void tryGetSession();
      }, POLL_INTERVAL_MS);

      // Initial immediate attempt
      void tryGetSession();
    });
  }

  return pendingSessionPromise;
}
