// src/app/providers/AuthProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/browserClient';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    // Get initial session via server endpoint to avoid client-side refresh/rotation
    (async () => {
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' });
        if (res.ok) {
          const body = await res.json();
          setSession(body.session ?? null);
          setUser(body.user ?? null);
        }
      } finally {
        setLoading(false);
      }
    })();

    // Listen for auth changes (but no auto-refresh since our client has autoRefreshToken: false)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });
    // Listen for forced-logout events to update UI immediately before navigation
    function onForcedLogout() {
      setSession(null);
      setUser(null);
      // keep loading false so UI shows logged-out state instantly
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('auth:logout', onForcedLogout as EventListener);
    }

  return () => {
      subscription.unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('auth:logout', onForcedLogout as EventListener);
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
