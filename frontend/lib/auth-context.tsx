"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

type AuthState = {
  token: string | null;
  /** True after first `getSession` resolves (logged out users are also "ready"). */
  ready: boolean;
};

const AuthContext = createContext<AuthState>({ token: null, ready: false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) {
        setToken(session?.access_token ?? null);
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({ token, ready }), [token, ready]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useRequireAuthToken(): string | null {
  const { token, ready } = useAuth();
  if (!ready) {
    return null;
  }
  return token;
}
