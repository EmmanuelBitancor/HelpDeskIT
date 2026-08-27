"use client";

import { useState } from "react";
import type { Ticket } from "../types";

interface ReassignButtonProps {
  ticket: Ticket;
  staffList: Array<{ id: string; name: string; email: string; role: string; avatar: string; active: boolean }>;
  onReassign: (ticketId: string, staffId: string) => void;
}

export default function ReassignButton({ ticket, staffList, onReassign }: ReassignButtonProps) {
  const [open, setOpen] = useState(false);
  const activeStaff = staffList.filter((s) => s.active);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        Reassign
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-[60] mt-1 w-56 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <div className="px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
              Assign to
            </div>
            <div className="max-h-48 overflow-y-auto py-1">
              <button
                onClick={() => {
                  onReassign(ticket.id, "");
                  setOpen(false);
                }}
                className="flex w-full items-center px-3 py-2 text-left text-xs text-zinc-600 transition-colors hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Unassigned
              </button>
              {activeStaff.map((staff) => (
                <button
                  key={staff.id}
                  onClick={() => {
                    onReassign(ticket.id, staff.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                    ticket.assignedTo === staff.id
                      ? "text-foreground font-medium"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white ${
                      staff.avatar ? "bg-zinc-400" : "bg-zinc-500"
                    }`}
                  >
                    {staff.name.charAt(0)}
                  </span>
                  {staff.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
