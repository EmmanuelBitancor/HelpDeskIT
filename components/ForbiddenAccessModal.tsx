"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useFocusTrap } from "@/app/hooks/useFocusTrap";

interface ForbiddenAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  attemptedPath: string;
}

export default function ForbiddenAccessModal({
  isOpen,
  onClose,
  attemptedPath,
}: ForbiddenAccessModalProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, isOpen, onClose);

  // If user becomes authenticated while modal is open, close it and redirect
  useEffect(() => {
    if (!loading && user) {
      onClose();
    }
  }, [user, loading, onClose]);

  if (!isOpen) return null;

  const handleLogin = () => {
    onClose();
    router.replace("/");
  };

  const handleGoHome = () => {
    onClose();
    router.replace("/");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="forbiddenTitle"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h3 id="forbiddenTitle" className="text-lg font-semibold text-foreground">
            Access Restricted
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <svg
              className="h-7 w-7 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15l-7-7h14l-7 7zm0 0l-7-7m7 7l7-7"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 19l-7-7m7 7l7-7"
              />
            </svg>
          </div>

          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            You don&apos;t have permission to access this area. This section is restricted to authorized personnel only.
          </p>
          <p className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-500">
            Attempted: <span className="font-mono">{attemptedPath}</span>
          </p>
        </div>

        <div className="flex gap-3 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleLogin}
            className="flex-1 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-sm transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={handleGoHome}
            className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}