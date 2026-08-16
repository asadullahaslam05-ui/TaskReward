"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  createBrowserSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isConfigured: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  isLoading: true,
  isConfigured: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  // When Supabase is not configured there is nothing to load — start ready.
  const [isLoading, setIsLoading] = useState(configured);

  useEffect(() => {
    // If Supabase env vars are missing, do not attempt to create a client.
    // Treat the visitor as anonymous so the public homepage renders.
    if (!configured) {
      return;
    }

    let unsubscribe: (() => void) | undefined;

    try {
      const supabase = createBrowserSupabaseClient();

      supabase.auth.getSession().then(({ data }) => {
        setSession(data.session);
        setIsLoading(false);
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
        setIsLoading(false);
      });

      unsubscribe = () => subscription.unsubscribe();
    } catch (e) {
      console.error("[Auth] Failed to initialize Supabase client:", e);
      // Defer the state update so it isn't a synchronous setState in the
      // effect body (which would trigger cascading renders).
      queueMicrotask(() => setIsLoading(false));
    }

    return () => {
      unsubscribe?.();
    };
  }, [configured]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isLoading,
        isConfigured: configured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  return useContext(AuthContext);
}
