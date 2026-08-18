function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-700 ${className}`} />;
}

export { Skeleton };

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div role="status" aria-label="Loading dashboard" className="sr-only">Loading dashboard</div>
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-2 py-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div>
                <Skeleton className="h-5 w-32" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-9 w-20 rounded-lg" />
              <Skeleton className="h-5 w-48 hidden sm:block" />
              <Skeleton className="h-9 w-20 rounded-lg" />
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Skeleton className="h-8 w-56" />
            <Skeleton className="mt-2 h-4 w-full sm:w-80" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-36 rounded-lg" />
            <Skeleton className="h-10 w-32 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-8 w-12" />
            </div>
          ))}
        </div>
        <div className="mt-8">
          <div className="border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex gap-6">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
          <div className="mt-6 space-y-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                    <Skeleton className="mt-2 h-5 w-64" />
                    <Skeleton className="mt-2 h-4 w-full" />
                    <Skeleton className="mt-1 h-4 w-3/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export function SupportSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div role="status" aria-label="Loading support" className="sr-only">Loading support</div>
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-2 py-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div>
                <Skeleton className="h-5 w-48" />
                <Skeleton className="mt-1 h-3 w-36" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-5 w-32 hidden sm:block" />
              <Skeleton className="h-9 w-28 rounded-lg" />
              <Skeleton className="h-9 w-28 rounded-lg" />
              <Skeleton className="h-9 w-28 rounded-lg" />
              <Skeleton className="h-9 w-20 rounded-lg" />
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="mt-2 h-4 w-80" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-36 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-8 w-12" />
            </div>
          ))}
        </div>
        <div className="mt-8">
          <div className="border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex gap-6">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
          <div className="mt-6 space-y-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                    <Skeleton className="mt-2 h-5 w-64" />
                    <Skeleton className="mt-2 h-4 w-full" />
                    <Skeleton className="mt-1 h-4 w-3/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export function AdminSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div role="status" aria-label="Loading admin" className="sr-only">Loading admin</div>
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-2 py-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="mt-1 h-3 w-36" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-9 w-32 rounded-lg" />
               <Skeleton className="h-9 w-20 rounded-lg" />
               <Skeleton className="h-9 w-20 rounded-lg" />
               <Skeleton className="h-9 w-20 rounded-lg" />
              </div>
            </div>
          </div>
        </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="mt-2 h-4 w-80" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-40 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-8 w-12" />
            </div>
          ))}
        </div>
        <div className="mt-8">
          <div className="border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex gap-6">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
          <div className="mt-6 space-y-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                    <Skeleton className="mt-2 h-5 w-64" />
                    <Skeleton className="mt-2 h-4 w-full" />
                    <Skeleton className="mt-1 h-4 w-3/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export function SuperAdminSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div role="status" aria-label="Loading super-admin" className="sr-only">Loading super-admin</div>
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-2 py-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div>
                <Skeleton className="h-5 w-48" />
                <Skeleton className="mt-1 h-3 w-36" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-9 w-20 rounded-lg" />
              <Skeleton className="h-9 w-20 rounded-lg" />
              <Skeleton className="h-9 w-20 rounded-lg" />
              <SignOutButtonSkeleton />
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex gap-6 py-4">
          <div className="hidden lg:block w-64">
            <div className="space-y-2">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          </div>
          <div className="flex-1">
            <Skeleton className="h-8 w-48" />
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="mt-2 h-8 w-12" />
                </div>
              ))}
            </div>
            <div className="mt-8 space-y-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="mt-2 h-4 w-full" />
                  <Skeleton className="mt-1 h-4 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignOutButtonSkeleton() {
  return <Skeleton className="h-9 w-20 rounded-lg" />;
}
