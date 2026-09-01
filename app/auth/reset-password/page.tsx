"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);

  const MIN_PASSWORD_LENGTH = 8;
  const token = searchParams.get("token");

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setLinkError("This password reset link is invalid or has expired. Please request a new one.");
        setVerifying(false);
        return;
      }

      try {
        const res = await fetch(
          `/api/reset-password?token=${encodeURIComponent(token)}`,
          { method: "GET" }
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "This password reset link is invalid or has expired. Please request a new one.");
        }
      } catch (err) {
        setLinkError(err instanceof Error ? err.message : "This password reset link is invalid or has expired. Please request a new one.");
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  if (verifying) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8 safe-top safe-bottom">
        <div className="w-full max-w-md text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Verifying your reset link...</p>
        </div>
      </div>
    );
  }

  if (linkError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8 safe-top safe-bottom">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Invalid or Expired Link
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
      setFormError("The passwords you entered do not match. Please try again.");
      setLoading(false);
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`Your password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      setLoading(false);
      return;
    }

    if (!token) {
      setFormError("Missing reset token. Please use the link from your email.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong. Please try again or request a new reset link.");
      }

      setSuccess(true);
      setTimeout(() => {
        router.replace("/");
      }, 2000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong. Please try again or request a new reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8 safe-top safe-bottom">
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
              Your password has been updated! Redirecting you to the login page...
            </p>
          )}

          <button
            type="submit"
            disabled={loading || success}
            className="flex w-full justify-center rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-sm transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2 disabled:opacity-60"
          >
            {loading ? "Updating your password..." : "Update Password"}
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
        <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8 safe-top safe-bottom">
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
