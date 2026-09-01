"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { SupportStaff } from "../../types/ticket";

interface StaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: SupportStaff[];
  selectedStaff: SupportStaff | null;
  onSelectStaff: (staff: SupportStaff) => void;
  onAddStaff: () => void;
  onEditStaff: (staff: SupportStaff) => void;
  onToggleStaffStatus: (staffId: string) => void;
  onDeleteStaff: (staffId: string) => void;
  getStaffWorkload: (staffId: string) => {
    total: number;
    open: number;
    inProgress: number;
    critical: number;
  };
  getAvatarColor: (name: string) => string;
}

export default function StaffModal({
  isOpen,
  onClose,
  staffList,
  selectedStaff,
  onSelectStaff,
  onAddStaff,
  onEditStaff,
  onToggleStaffStatus,
  onDeleteStaff,
  getStaffWorkload,
  getAvatarColor,
}: StaffModalProps) {
  const [search, setSearch] = useState("");

  const filtered = staffList.filter((staff) => {
    const query = search.toLowerCase().trim();
    if (!query) return true;
    return (
      staff.name.toLowerCase().includes(query) ||
      staff.role.toLowerCase().includes(query) ||
      staff.email.toLowerCase().includes(query)
    );
  });

  const dialogRef = useRef<HTMLDivElement>(null);

  const getFocusableElements = useCallback(() => {
    if (!dialogRef.current) return [];
    return Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute("disabled"));
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
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
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus.focus();
    };
  }, [isOpen, onClose, getFocusableElements]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-2 safe-top safe-bottom sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="staffModalTitle"
        tabIndex={-1}
        className="my-2 flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900 sm:my-4 sm:max-h-[85vh]"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h3 id="staffModalTitle" className="text-lg font-semibold text-foreground">
            IT Support Staff
          </h3>
          <button
            onClick={onClose}
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

        <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 0010.5 18.75a7.5 7.5 0 00-7.5-7.5A7.5 7.5 0 003.75 10.5m0 0L21 21z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff by name, role, or email address..."
              className="w-full rounded-lg border border-zinc-300 py-2.5 pl-9 pr-4 text-sm text-foreground placeholder-zinc-400 outline-none transition-colors focus:border-foreground focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg
                className="h-10 w-10 text-zinc-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106c0 2.106.691 4.148 1.997 5.772M15 19.128a4.125 4.125 0 01-7.533-2.493M15 19.128c-1.113 0-2.16-.285-3.07-.786M15 19.128c-2.106 0-4.148-.691-5.772-1.997M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
                />
              </svg>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                No staff members match your search
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Try adjusting your search terms or add a new staff member
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((staff) => {
                const workload = getStaffWorkload(staff.id);
                const isSelected = selectedStaff?.id === staff.id;
                return (
                  <div
                    key={staff.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    className={`rounded-xl border p-4 transition-colors cursor-pointer ${
                      isSelected
                        ? "border-foreground bg-zinc-50 dark:border-foreground dark:bg-zinc-800/50"
                        : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                    } ${!staff.active ? "opacity-75" : ""}`}
                    onClick={() => onSelectStaff(staff)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        if (e.target !== e.currentTarget) return;
                        e.preventDefault();
                        onSelectStaff(staff);
                      }
                    }}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${
                          staff.active ? getAvatarColor(staff.name) : "bg-zinc-400"
                        }`}
                      >
                        {staff.avatar}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-foreground">
                            {staff.name}
                          </h4>
                          {!staff.active && (
                            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {staff.email}
                        </p>
                        <p className="text-xs text-zinc-600 dark:text-zinc-300">
                          {staff.role}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-start sm:gap-4">
                        <div className="flex gap-4 text-center">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {workload.total}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              Active
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-amber-600">
                              {workload.inProgress}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              In Progress
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-red-600">
                              {workload.critical}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              Critical
                            </p>
                          </div>
                        </div>
                        <div
                          className="flex flex-wrap items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => onEditStaff(staff)}
                            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            Edit Details
                          </button>
                          <button
                            onClick={() => onToggleStaffStatus(staff.id)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                              staff.active
                                ? "border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300"
                            }`}
                          >
                            {staff.active ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  `Are you sure you want to remove ${staff.name}? This will unassign them from all tickets.`
                                )
                              ) {
                                onDeleteStaff(staff.id);
                              }
                            }}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <button
            onClick={onAddStaff}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-sm transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2"
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
                d="M18 7.5v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Add New Staff Member
          </button>
        </div>
      </div>
    </div>
  );
}


