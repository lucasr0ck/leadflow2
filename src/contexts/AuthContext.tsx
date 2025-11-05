
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
    console.log('🟡🟡🟡 [AuthProvider] USEEFFECT INICIOU - Initializing authentication...');
    console.log('🟡 [AuthProvider] Window location:', window.location.href);
    console.log('🟡 [AuthProvider] localStorage keys:', Object.keys(localStorage));
    
    try {
      // Set up auth state listener FIRST
      console.log('🟡 [AuthProvider] Configurando onAuthStateChange listener...');
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('🟡🟡🟡 [AuthProvider] AUTH STATE CHANGE:', event);
          console.log('🟡 [AuthProvider] Session:', session?.user?.email || 'NO SESSION');
          console.log('🟡 [AuthProvider] User ID:', session?.user?.id || 'NO USER');
          
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
          
          console.log('🟡 [AuthProvider] State atualizado:', { 
            hasSession: !!session, 
            hasUser: !!session?.user,
            loading: false 
          });

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
      console.log('🟡 [AuthProvider] Verificando sessão existente com getSession()...');
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error) {
          console.error('🟡❌ [AuthProvider] ERRO ao buscar sessão:', error);
        }
        console.log('🟡 [AuthProvider] Sessão inicial:', session?.user?.email || 'NO SESSION');
        console.log('🟡 [AuthProvider] Access token:', session?.access_token ? 'EXISTS' : 'NO TOKEN');
        console.log('🟡 [AuthProvider] Expires at:', session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'N/A');
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        console.log('🟡✅ [AuthProvider] Estado inicial configurado:', {
          hasSession: !!session,
          hasUser: !!session?.user,
          loading: false
        });
      }).catch((error) => {
        console.error('🟡❌ [AuthProvider] FALHA CRÍTICA ao buscar sessão:', error);
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
    console.log('🔴🔴🔴 [AuthContext] signOut CALLED - INÍCIO');
    try {
      console.log('🔴 [AuthContext] Chamando supabase.auth.signOut()...');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('🔴❌ [AuthContext] ERRO ao fazer signOut:', error);
        throw error;
      }
      
      console.log('🔴✅ [AuthContext] supabase.auth.signOut() executado com sucesso');
      console.log('🔴 [AuthContext] Limpando localStorage...');
      
      // Limpar localStorage explicitamente
      localStorage.removeItem('leadflow_current_team_id');
      
      console.log('🔴✅ [AuthContext] localStorage limpo');
      console.log('🔴 [AuthContext] Redirecionando para /login...');
      
      // Redirecionar FORÇADO para login
      window.location.href = '/login';
      
      console.log('🔴✅ [AuthContext] signOut COMPLETO');
    } catch (error) {
      console.error('🔴❌ [AuthContext] ERRO CRÍTICO em signOut:', error);
      
      // Mesmo com erro, forçar logout
      localStorage.clear();
      window.location.href = '/login';
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
