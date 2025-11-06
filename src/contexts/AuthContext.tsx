
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthLoading: boolean; // Novo nome sem ambiguidade com outros loadings
  isVerifyingAuth: boolean; // Alias explícito para padrão de bloqueio de render
  hasResolvedAuth: boolean; // true após primeira resolução (mesmo que sem usuário)
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [hasResolvedAuth, setHasResolvedAuth] = useState(false);
  const { logAudit } = useAuditLog();

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      console.log('[AuthProvider] 🔄 Inicializando verificação de sessão...');
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[AuthProvider] Sessão inicial erro:', error.message);
        }
        if (cancelled) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
        setHasResolvedAuth(true);
        setIsAuthLoading(false);
        console.log('[AuthProvider] ✅ Sessão inicial resolvida:', {
          hasUser: !!data.session?.user,
          email: data.session?.user?.email,
        });
      } catch (e) {
        if (cancelled) return;
        console.error('[AuthProvider] ❌ Falha ao obter sessão inicial:', e);
        setHasResolvedAuth(true);
        setIsAuthLoading(false);
      }
    };

    init();

    // Listener para mudanças futuras
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;
      console.log('[AuthProvider] Auth event:', event);
      setSession(session);
      setUser(session?.user ?? null);
      if (!hasResolvedAuth) {
        setHasResolvedAuth(true);
        setIsAuthLoading(false);
      }
      if (event === 'SIGNED_IN' && session?.user) {
        await logAudit({ action_type: 'login', metadata: { email: session.user.email, event } });
      } else if (event === 'SIGNED_OUT') {
        await logAudit({ action_type: 'logout', metadata: { event } });
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [hasResolvedAuth, logAudit]);

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

  const signOut = useCallback(async () => {
    console.log('🔴🔴🔴 [AuthContext] signOut CALLED - INÍCIO');
    
    // Prevent multiple simultaneous calls
    if (isAuthLoading) {
      console.log('🔴⚠️ [AuthContext] signOut já em andamento, ignorando chamada duplicada');
      return;
    }
    
    try {
  setIsAuthLoading(true);
      console.log('🔴 [AuthContext] Chamando supabase.auth.signOut()...');
      
      // Limpar localStorage ANTES de fazer signOut para evitar race conditions
      localStorage.removeItem('leadflow_current_team_id');
      console.log('🔴✅ [AuthContext] localStorage limpo');
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('🔴❌ [AuthContext] ERRO ao fazer signOut:', error);
        // Continuar mesmo com erro
      } else {
        console.log('🔴✅ [AuthContext] supabase.auth.signOut() executado com sucesso');
      }
      
      // Sempre redirecionar, mesmo se houver erro
      console.log('🔴 [AuthContext] Redirecionando para /login...');
      window.location.href = '/login';
      
      console.log('🔴✅ [AuthContext] signOut COMPLETO');
    } catch (error) {
      console.error('🔴❌ [AuthContext] ERRO CRÍTICO em signOut:', error);
      
      // Mesmo com erro, forçar logout e redirecionar
      localStorage.clear();
      window.location.href = '/login';
    } finally {
      setIsAuthLoading(false);
    }
  }, [isAuthLoading]);

  return (
    <AuthContext.Provider value={{ user, session, isAuthLoading, isVerifyingAuth: isAuthLoading, hasResolvedAuth, signIn, signOut }}>
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
