// src/app/providers/AuthProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/browserClient';
import type { User, Session } from '@supabase/supabase-js';
import { repairClientSession } from '@/lib/supabase/repair';

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
      } catch {
        // Swallow auth errors and allow UI to proceed; we'll also listen below
      } finally {
        setLoading(false);
      }
    })();

    // Listen for auth changes (but no auto-refresh since our client has autoRefreshToken: false)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        setSession(session);
        setUser(session?.user ?? null);
        if (!session) {
          // Attempt to repair client from server cookies when tokens are missing/invalid
          const rep = await repairClientSession();
          if (rep.ok) {
            try {
              const { data } = await supabase.auth.getSession();
              setSession(data.session ?? null);
              setUser(data.session?.user ?? null);
            } catch {}
          } else {
            try {
              const res = await fetch('/api/auth/session', { cache: 'no-store' });
              if (res.ok) {
                const body = await res.json();
                setSession(body.session ?? null);
                setUser(body.user ?? null);
              }
            } catch {}
          }
        }
      } catch (e) {
        // If Supabase throws an Invalid Refresh Token error, purge and repair
        const msg = (e && typeof e === 'object' && 'message' in e) ? String((e as { message?: string }).message) : String(e);
        if (/Invalid Refresh Token/i.test(msg) || /Already Used/i.test(msg) || /Refresh Token Not Found/i.test(msg)) {
          try { await repairClientSession(); } catch {}
        }
      } finally {
        setLoading(false);
      }
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
