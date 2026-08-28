"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Forbidden() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/");
    }, 5000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <svg
              className="h-8 w-8 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
        </div>
        <h1 className="text-3xl font-semibold text-foreground">403 - Forbidden</h1>
           <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
             You don&apos;t have permission to access this page. This area is restricted to users with higher privileges.
           </p>
           <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
             You&apos;ll be redirected to the home page in 5 seconds...
           </p>
        <button
          onClick={() => router.replace("/")}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-sm transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2"
        >
          Go to Home Page
        </button>
      </div>
    </div>
  );
}

