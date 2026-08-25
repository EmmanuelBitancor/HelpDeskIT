"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { type Role } from "./authTypes";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";

export type { Role };

export interface Account {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
}

interface AuthContextValue {
  user: Account | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string; role?: Role }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem("sessionId");
    } catch {
      return null;
    }
  });
  const supabase = createClient();

  useEffect(() => {
    let loadId = 0;

    const loadProfile = async () => {
      const id = ++loadId;
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (id !== loadId) return;

      if (!authUser?.email) {
        setUser(null);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("accounts")
        .select("id, name, email, role, avatar")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (id !== loadId) return;

      setUser((profile as Account) ?? null);
      setLoading(false);
    };

    loadProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        loadId++;
        setUser(null);
        setSessionId(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("sessionId");
        }
        setLoading(false);
      } else if (event === "SIGNED_IN") {
        loadProfile();
      } else {
        loadProfile();
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      await logActivity({ action: "login_failed", details: error.message });
      return { ok: false, error: error.message };
    }

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser?.email) {
      await logActivity({ action: "login_failed", details: "No user after auth" });
      return { ok: false, error: "Authentication failed." };
    }

    const { data: profile } = await supabase
      .from("accounts")
      .select("id, name, email, role, avatar")
      .eq("user_id", authUser.id)
      .maybeSingle();

    if (!profile) {
      await logActivity({ action: "login_failed", details: "No profile found" });
      return {
        ok: false,
        error: "No account profile found. Contact an administrator.",
      };
    }

    const account = profile as Account;
    setUser(account);

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok && data.sessionId) {
        const sessionIdValue = data.sessionId as string;
        setSessionId(sessionIdValue);
        if (typeof window !== "undefined") {
          localStorage.setItem("sessionId", sessionIdValue);
        }
      }
    } catch {
      // session tracking is best-effort
    }

    await logActivity({ action: "login", details: `Signed in as ${account.email}` });
    return { ok: true, role: account.role };
  };

  const signOut = async () => {
    const currentSessionId = sessionId;
    const currentUser = user;
    if (currentSessionId) {
      try {
        await fetch("/api/sessions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: currentSessionId }),
        });
      } catch {
        // best-effort cleanup
      }
    }
    if (currentUser) {
      await logActivity({ action: "logout", details: `Signed out ${currentUser.email}` });
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("sessionId");
    }
    setUser(null);
    setSessionId(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
