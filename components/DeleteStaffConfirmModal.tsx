"use client";

import { useEffect, useRef } from "react";
import { useFocusTrap } from "@/app/hooks/useFocusTrap";

interface DeleteStaffConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  staffName: string;
}

export default function DeleteStaffConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  staffName,
}: DeleteStaffConfirmModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deleteStaffConfirmTitle"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h3
            id="deleteStaffConfirmTitle"
            className="text-lg font-semibold text-foreground"
          >
            Remove Support Staff
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Are you sure you want to remove {staffName} from support staff?
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
            Their account will be suspended and open tickets will be unassigned.
          </p>
        </div>

        <div className="flex gap-3 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-2"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
