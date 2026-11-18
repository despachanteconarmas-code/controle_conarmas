import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Este Supabase também guarda os logins dos filiados (app da carteira).
// Só a equipe (profiles.role STAFF/ADMIN) entra no sistema de OS.
// Retorna false apenas quando o banco confirma que a conta não é da
// equipe. Se a consulta falhar (rede, por exemplo), não derruba ninguém:
// a RLS do banco continua barrando os dados de qualquer jeito.
async function isStaffAccount(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_staff');
  if (error) {
    console.error('Erro ao verificar acesso da equipe:', error);
    return true;
  }
  return data === true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Configurar listener de mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Verificar sessão existente (e se ela ainda é de alguém da equipe)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session && !(await isStaffAccount())) {
        await supabase.auth.signOut();
        session = null;
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        let errorMessage = 'Erro ao fazer login';
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Email ou senha incorretos';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Email não confirmado. Verifique sua caixa de entrada.';
        }

        toast({
          variant: "destructive",
          title: "Erro de Login",
          description: errorMessage,
        });
        return { error };
      }

      if (!(await isStaffAccount())) {
        await supabase.auth.signOut();
        toast({
          variant: "destructive",
          title: "Acesso restrito",
          description: "Esta conta não tem acesso ao sistema de OS. Fale com a administração da Conarmas.",
        });
        return { error: new Error('Conta sem acesso de equipe') };
      }

      toast({
        title: "Login realizado",
        description: "Bem-vindo de volta!",
      });
      return { error: null };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao fazer logout",
      });
    } else {
      toast({
        title: "Logout realizado",
        description: "Até logo!",
      });
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
