
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { logAudit } = useAuditLog();

  useEffect(() => {
    console.log('AuthProvider: Initializing authentication...');
    
    try {
      // Set up auth state listener FIRST
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('Auth state change:', event, session?.user?.email);
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);

          // Log authentication events
          if (event === 'SIGNED_IN' && session?.user) {
            await logAudit({
              action_type: 'login',
              metadata: {
                email: session.user.email,
                event: event,
              }
            });
          } else if (event === 'SIGNED_OUT') {
            await logAudit({
              action_type: 'logout',
              metadata: {
                event: event,
              }
            });
          }
        }
      );

      // THEN check for existing session
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error) {
          console.error('Error getting session:', error);
        }
        console.log('Initial session check:', session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }).catch((error) => {
        console.error('Failed to get session:', error);
        setLoading(false);
      });

      return () => subscription.unsubscribe();
    } catch (error) {
      console.error('AuthProvider initialization error:', error);
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (!error) {
        // The audit log will be created by the onAuthStateChange listener
        console.log('Login successful');
      }
      
      return { error };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      // The audit log will be created by the onAuthStateChange listener
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
