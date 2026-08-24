import { useState, useEffect } from "react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);
  if (page > 1) pages.add(page - 1);
  pages.add(page);
  if (page < totalPages) pages.add(page + 1);
  if (page > 2) pages.add(page - 2);
  if (page < totalPages - 1) pages.add(page + 2);

  const sorted = Array.from(pages).sort((a, b) => a - b);

  return (
    <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        Page {page} of {totalPages}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Previous
        </button>
        {sorted.map((p, i) => {
          const showEllipsis = i > 0 && sorted[i - 1] !== p - 1;
          return (
            <span key={p} className="flex items-center gap-1">
              {showEllipsis && (
                <span className="px-1 text-xs text-zinc-400">...</span>
              )}
              <button
                onClick={() => onPageChange(p)}
                className={`h-7 w-7 rounded-md text-xs font-medium transition-colors ${
                  p === page
                    ? "bg-foreground text-background"
                    : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {p}
              </button>
            </span>
          );
        })}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Next
        </button>
      </div>
    </div>
  );
}

const PAGE_SIZE = 10;

export function usePagination<T>(items: T[]): { paginatedItems: T[]; page: number; totalPages: number; setPage: (page: number) => void } {
  const [page, setPage] = useState(() => Math.max(1, Math.ceil(items.length / PAGE_SIZE) || 1));

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage((prev) => Math.min(prev, maxPage));
  }, [items.length]);

  const paginatedItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));

  return { paginatedItems, page, totalPages, setPage };
}
