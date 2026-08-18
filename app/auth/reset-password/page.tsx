"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const accessToken = searchParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token");

  if (!accessToken || !refreshToken) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Invalid Link
          </h1>
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            This password reset link is invalid or has expired.
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
    setError(null);
    setLoading(true);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
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
      setError(err instanceof Error ? err.message : "Something went wrong");
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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="Min. 6 characters"
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
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="Repeat new password"
            />
          </div>

          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
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
