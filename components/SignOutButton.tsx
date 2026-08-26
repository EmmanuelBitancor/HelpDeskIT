"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleConfirm = async () => {
    setError(null);
    setConfirmOpen(false);
    router.replace("/");
    try {
      await signOut();
    } catch {
      // Already redirecting, ignore sign-out errors after navigation started.
    }
  };

  const getFocusableElements = useCallback(() => {
    if (!dialogRef.current) return [];
    return Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute("disabled"));
  }, []);

  useEffect(() => {
    if (!confirmOpen) return;

    const previousFocus = document.activeElement as HTMLElement;
    triggerRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConfirmOpen(false);
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = getFocusableElements();
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !dialogRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !dialogRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus.focus();
    };
  }, [confirmOpen, getFocusableElements]);

  if (!user) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setError(null);
          setConfirmOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.25 10.25V6a2.25 2.25 0 00-2.25-2.25h-5.5A2.25 2.25 0 007.5 6v10.25a2.25 2.25 0 002.25 2.25h5.5a2.25 2.25 0 002.25-2.25V10.25zM12 15V3m0 0l3 3m-3-3l-3 3"
          />
        </svg>
        Sign Out
      </button>

      {confirmOpen &&
        (typeof document !== "undefined"
          ? createPortal(
              <div
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
                onClick={() => setConfirmOpen(false)}
                aria-label="Close"
                role="presentation"
              >
                <div
                  ref={dialogRef}
                  className="w-full max-w-sm rounded-xl border border-zinc-200 bg-background p-6 shadow-xl dark:border-zinc-800"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Sign out confirmation"
                >
                  <h3 className="text-lg font-semibold text-foreground">
                    Sign Out
                  </h3>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    Are you sure you want to sign out?
                  </p>
                  {error && (
                    <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
                  )}
                  <div className="mt-5 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirmOpen(false)}
                      className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirm}
                      className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:opacity-90"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null)}
    </>
  );
}
