"use client";

import { useState, useRef, useEffect } from "react";
import { useFocusTrap } from "@/app/hooks/useFocusTrap";

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialName: string;
  initialEmail: string;
  onUpdated?: () => void;
}

export default function ProfileSettingsModal({
  isOpen,
  onClose,
  initialName,
  initialEmail,
  onUpdated,
}: ProfileSettingsModalProps) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(initialName);
      setEmail(initialEmail);
    }
  }, [isOpen, initialName, initialEmail]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  useFocusTrap(dialogRef, isOpen, handleClose);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      if (newPassword && newPassword !== confirmPassword) {
        throw new Error("The passwords you entered do not match. Please try again.");
      }
      if (newPassword && !currentPassword) {
        throw new Error("Please enter your current password to change it.");
      }
      if (newPassword && newPassword.length < 8) {
        throw new Error("Your new password must be at least 8 characters long.");
      }

      let passwordUpdated = false;

      if (newPassword) {
        const res = await fetch("/api/reauthenticate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: initialEmail, password: currentPassword }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "The current password you entered is incorrect. Please try again.");
        }
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { error: authError } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (authError) throw new Error(authError.message);
        passwordUpdated = true;
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }

      const updatePayload: Record<string, string> = {};
      if (name !== initialName) updatePayload.name = name.trim();
      if (email !== initialEmail) updatePayload.email = email.trim();

      if (Object.keys(updatePayload).length > 0) {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "We couldn't update your profile. Please try again.");
        const profileUpdateMsg = "Your profile has been updated successfully!";
        setSuccess((prev) => (prev ? `${prev}\n${profileUpdateMsg}` : profileUpdateMsg));
        onUpdated?.();
      }

      if (passwordUpdated) {
        setSuccess((prev) =>
          prev ? `${prev}\nYour password has been updated successfully!` : "Your password has been updated successfully!"
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4 safe-top safe-bottom sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profileSettingsTitle"
        tabIndex={-1}
        className="my-4 w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h3 id="profileSettingsTitle" className="text-lg font-semibold text-foreground">
            Profile Settings
          </h3>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-scroll max-h-[75vh] space-y-4 p-6 sm:max-h-none">
          <div>
            <label htmlFor="profileName" className="block text-sm font-medium text-foreground">
              Full Name
            </label>
            <input
              id="profileName"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div>
            <label htmlFor="profileEmail" className="block text-sm font-medium text-foreground">
              Email Address
            </label>
            <input
              id="profileEmail"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Change Your Password
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-foreground">
                  Current Password
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="Enter your current password to verify your identity"
                />
              </div>
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-foreground">
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="Re-enter your new password"
                />
              </div>
            </div>
          </div>

          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {success && <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-sm transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2 disabled:opacity-50"
            >
              {isSubmitting ? "Saving changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
