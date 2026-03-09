/**
 * AuthContext.tsx
 * Provides session + staff_profile to the entire admin app.
 * Place in: src/context/AuthContext.tsx
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";

export interface StaffUser {
  id: string;
  email: string;
  display_name: string;
  role: "super_admin" | "agent";
}

interface AuthContextValue {
  session: Session | null;
  user: StaffUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(s: Session | null) {
    if (!s) {
      setUser(null);
      return;
    }

    const { data, error } = await supabase
      .from("staff_profiles")
      .select("id, display_name, role")
      .eq("id", s.user.id)
      .single();

    if (error || !data) {
      setUser(null);
      return;
    }

    setUser({
      id: s.user.id,
      email: s.user.email ?? "",
      display_name: data.display_name,
      role: data.role,
    });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      loadProfile(session).finally(() => setLoading(false));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      loadProfile(session);

      // Session expired or signed out — clear user and let App.tsx redirect to login
      if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !session)) {
        setUser(null);
        setSession(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
