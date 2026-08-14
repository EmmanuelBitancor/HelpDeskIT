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
        .eq("email", authUser.email)
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
        setLoading(false);
      } else {
        loadProfile();
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser?.email) return { ok: false, error: "Authentication failed." };

    const { data: profile } = await supabase
      .from("accounts")
      .select("id, name, email, role, avatar")
      .eq("email", authUser.email)
      .maybeSingle();

    if (!profile) {
      return {
        ok: false,
        error: "No account profile found. Contact an administrator.",
      };
    }

    const account = profile as Account;
    setUser(account);
    return { ok: true, role: account.role };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    setUser(null);
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
