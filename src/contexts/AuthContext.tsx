import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthError, Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const RECOVERY_KEY = 'payday_recovery';

type AuthView = 'login' | 'signup' | 'forgot' | 'check-email';
type PendingEmailPurpose = 'signup' | 'reset';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isRecovery: boolean;
  authView: AuthView;
  pendingEmail: string;
  pendingEmailPurpose: PendingEmailPurpose | null;
  setAuthView: (view: AuthView) => void;
  signIn: (email: string, password: string) => Promise<AuthError | null>;
  signUp: (email: string, password: string) => Promise<AuthError | null>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthError | null>;
  updatePassword: (password: string) => Promise<AuthError | null>;
  finishRecovery: () => void;
  deleteAccount: () => Promise<string | null>;
  resendConfirmation: () => Promise<AuthError | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getRedirectUrl(): string {
  return window.location.origin;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingEmailPurpose, setPendingEmailPurpose] = useState<PendingEmailPurpose | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setIsRecovery(sessionStorage.getItem(RECOVERY_KEY) === '1');
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
        sessionStorage.setItem(RECOVERY_KEY, '1');
      }

      if (event === 'SIGNED_OUT') {
        setIsRecovery(false);
        sessionStorage.removeItem(RECOVERY_KEY);
        setAuthView('login');
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) return null;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: getRedirectUrl() },
    });

    if (!error) {
      setPendingEmail(email);
      setPendingEmailPurpose('signup');
      setAuthView('check-email');
    }

    return error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getRedirectUrl(),
    });

    if (!error) {
      setPendingEmail(email);
      setPendingEmailPurpose('reset');
      setAuthView('check-email');
    }

    return error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    // isRecovery는 vault 복구(복구 키 입력)가 끝난 뒤 finishRecovery로 해제
    return error;
  }, []);

  const finishRecovery = useCallback(() => {
    setIsRecovery(false);
    sessionStorage.removeItem(RECOVERY_KEY);
  }, []);

  const resendConfirmation = useCallback(async () => {
    if (!pendingEmail) {
      return { message: '이메일이 없습니다.', name: 'AuthError', status: 400 } as AuthError;
    }

    if (pendingEmailPurpose === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(pendingEmail, {
        redirectTo: getRedirectUrl(),
      });
      return error;
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: pendingEmail,
      options: { emailRedirectTo: getRedirectUrl() },
    });

    return error;
  }, [pendingEmail, pendingEmailPurpose]);

  const deleteAccount = useCallback(async () => {
    const { error } = await supabase.rpc('delete_user');

    if (error) {
      return error.message;
    }

    await supabase.auth.signOut();
    return null;
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      isRecovery,
      authView,
      pendingEmail,
      pendingEmailPurpose,
      setAuthView,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      finishRecovery,
      deleteAccount,
      resendConfirmation,
    }),
    [
      user,
      session,
      loading,
      isRecovery,
      authView,
      pendingEmail,
      pendingEmailPurpose,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      finishRecovery,
      deleteAccount,
      resendConfirmation,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
