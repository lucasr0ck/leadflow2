
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
    
    let isInitialized = false; // Prevenir múltiplas inicializações
    
    // 1. PRIMEIRO: Buscar sessão existente (síncrono, imediato)
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('🟡❌ [AuthProvider] ERRO ao buscar sessão:', error);
      }
      
      console.log('🟡 [AuthProvider] Sessão inicial:', session?.user?.email || 'NO SESSION');
      
      // Definir estado inicial APENAS se ainda não foi inicializado
      if (!isInitialized) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        isInitialized = true;
        
        console.log('🟡✅ [AuthProvider] Estado inicial configurado:', {
          hasSession: !!session,
          hasUser: !!session?.user,
          email: session?.user?.email,
          loading: false
        });
      }
    }).catch((error) => {
      console.error('🟡❌ [AuthProvider] FALHA ao buscar sessão:', error);
      if (!isInitialized) {
        setLoading(false);
        isInitialized = true;
      }
    });

    // 2. DEPOIS: Configurar listener para mudanças futuras
    console.log('🟡 [AuthProvider] Configurando onAuthStateChange listener...');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🟡🟡🟡 [AuthProvider] AUTH STATE CHANGE:', event);
        console.log('🟡 [AuthProvider] Session:', session?.user?.email || 'NO SESSION');
        
        // Atualizar estado em mudanças futuras
        setSession(session);
        setUser(session?.user ?? null);
        
        // Garantir que loading seja false após qualquer mudança de auth
        if (!isInitialized) {
          setLoading(false);
          isInitialized = true;
        }
        
        console.log('🟡 [AuthProvider] State atualizado:', { 
          event,
          hasSession: !!session, 
          hasUser: !!session?.user,
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

    return () => {
      console.log('🟡 [AuthProvider] Limpando subscription...');
      subscription.unsubscribe();
    };
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

  const signOut = useCallback(async () => {
    console.log('🔴🔴🔴 [AuthContext] signOut CALLED - INÍCIO');
    
    // Prevent multiple simultaneous calls
    if (loading) {
      console.log('🔴⚠️ [AuthContext] signOut já em andamento, ignorando chamada duplicada');
      return;
    }
    
    try {
      setLoading(true);
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
      setLoading(false);
    }
  }, [loading]);

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
