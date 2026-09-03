"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/AuthContext";
import { roleRoutes } from "@/context/authTypes";

export default function AccountSwitcher() {
  const { user, signIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleSwitch = async () => {
    if (switching) return;
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    setSwitching(true);
    setError(null);
    try {
      const result = await signIn(email.trim(), password);
      if (!result.ok || !result.role) {
        throw new Error(result.error || "Unable to switch account.");
      }
      setOpen(false);
      // Reload the destination so the current dashboard guard cannot briefly
      // evaluate the newly signed-in role against the old dashboard route.
      window.location.replace(roleRoutes[result.role]);
    } catch (switchError) {
      setError(
        switchError instanceof Error
          ? switchError.message
          : "Unable to switch account.",
      );
    } finally {
      setSwitching(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setEmail("");
          setPassword("");
          setShowPassword(false);
          setError(null);
          setOpen(true);
        }}
        className="dashboard-action-button"
        aria-label="Switch account"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 7.5h3.75m0 0v3.75m0-3.75l-5.25 5.25M8.25 16.5H4.5m0 0v-3.75m0 3.75l5.25-5.25" />
        </svg>
        <span className="hidden sm:inline">Switch Account</span>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
              onClick={() => setOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-xl border border-zinc-200 bg-background p-6 shadow-xl dark:border-zinc-800"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Switch account"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Switch account</h2>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      Sign in with the account you want to use.
                    </p>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} className="text-2xl leading-none text-zinc-400 hover:text-foreground" aria-label="Close">
                    &times;
                  </button>
                </div>

                <form
                  className="mt-5 space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSwitch();
                  }}
                >
                  <label className="block text-sm font-medium text-foreground">
                    Email
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@company.com"
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground dark:border-zinc-700"
                      autoFocus
                      autoComplete="username"
                    />
                  </label>
                  <label className="block text-sm font-medium text-foreground">
                    Password
                    <div className="relative mt-1">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Enter password"
                        className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 pr-10 text-sm outline-none focus:border-foreground dark:border-zinc-700"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-zinc-500 hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-200 focus:outline-none"
                      >
                        {showPassword ? (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </label>
                  {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                      Cancel
                    </button>
                    <button type="submit" disabled={switching} className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70">
                      {switching ? "Signing in..." : "Switch account"}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
