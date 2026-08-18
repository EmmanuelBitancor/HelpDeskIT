"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(true);

  const MIN_PASSWORD_LENGTH = 8;

  useEffect(() => {
    const establishRecoverySession = async () => {
      const supabase = createClient();
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token") || searchParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token") || searchParams.get("refresh_token");
        const code = searchParams.get("code");

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          throw new Error("No recovery tokens found");
        }

        const url = new URL(window.location.href);
        url.hash = "";
        ["access_token", "refresh_token", "code"].forEach((param) => {
          url.searchParams.delete(param);
        });
        router.replace(url.pathname + url.search);
      } catch (err) {
        setLinkError(err instanceof Error ? err.message : "Invalid or expired reset link");
      } finally {
        setRecovering(false);
      }
    };

    establishRecoverySession();
  }, [searchParams]);

  if (recovering) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Establishing secure session...</p>
        </div>
      </div>
    );
  }

  if (linkError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Invalid Link
          </h1>
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {linkError}
          </p>
          <button
            onClick={() => router.replace("/")}
            className="mt-4 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setLoading(true);

    if (password !== confirmPassword) {
      setFormError("Passwords do not match");
      setLoading(false);
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => {
        router.replace("/");
      }, 2000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Reset Password
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Enter your new password below
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              New Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-900"
              placeholder={`Min. ${MIN_PASSWORD_LENGTH} characters`}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-900"
              placeholder={`Repeat new password`}
            />
          </div>

          {formError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
          {success && (
            <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
              Password updated! Redirecting...
            </p>
          )}

          <button
            type="submit"
            disabled={loading || success}
            className="flex w-full justify-center rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-sm transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2 disabled:opacity-60"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
          <div className="w-full max-w-md text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
