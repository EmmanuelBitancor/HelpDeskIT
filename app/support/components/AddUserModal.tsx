"use client";

import { useState, useRef, useCallback } from "react";
import { useFocusTrap } from "@/app/hooks/useFocusTrap";

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: (user: { id: string; name: string; email: string; role: string }) => void;
}

export default function AddUserModal({ isOpen, onClose, onAdded }: AddUserModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  useFocusTrap(dialogRef, isOpen, handleClose);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add user");
      }

      onAdded(data.user);
      setName("");
      setEmail("");
      setPassword("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="addUserTitle"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h3 id="addUserTitle" className="text-lg font-semibold text-foreground">
            Add New User
          </h3>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close add user dialog"
            className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-foreground">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="Enter full name"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="Enter email address"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="Min. 8 characters"
            />
          </div>
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-foreground">
              Role
            </label>
            <select
              id="role"
              value="User"
              disabled
              className="mt-1 block w-full rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
            >
              <option value="User">User</option>
            </select>
            <p className="mt-1 text-xs text-zinc-400">Only users can be added from the support dashboard.</p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-sm transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2 disabled:opacity-50"
            >
              {isSubmitting ? "Adding..." : "Add User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
