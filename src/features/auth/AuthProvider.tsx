import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

type AuthState = {
  /** false until Supabase keys are set in .env; sign-in features are then hidden. */
  configured: boolean;
  loading: boolean;
  session: Session | null;
};

const AuthContext = createContext<AuthState>({ configured: false, loading: false, session: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [state, setState] = useState<AuthState>({ configured, loading: configured, session: null });

  useEffect(() => {
    if (!configured) return;
    const auth = getSupabase().auth;

    auth
      .getSession()
      .then(({ data }) => setState({ configured, loading: false, session: data.session }))
      .catch(() => setState({ configured, loading: false, session: null }));

    const { data: listener } = auth.onAuthStateChange((_event, session) => {
      setState({ configured, loading: false, session });
    });

    // Refresh tokens only while the app is in the foreground (saves battery and data).
    const appState =
      Platform.OS === 'web'
        ? null
        : AppState.addEventListener('change', (status) => {
            if (status === 'active') void auth.startAutoRefresh();
            else void auth.stopAutoRefresh();
          });

    return () => {
      listener.subscription.unsubscribe();
      appState?.remove();
    };
  }, [configured]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
