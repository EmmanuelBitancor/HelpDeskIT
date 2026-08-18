export type ActivityAction =
  | "login"
  | "login_failed"
  | "logout"
  | "user_approved"
  | "user_status_changed"
  | "user_created"
  | "staff_created"
  | "staff_updated"
  | "staff_status_changed"
  | "staff_deleted"
  | "ticket_created"
  | "ticket_updated"
  | "ticket_assigned";

export async function logActivity(params: {
  action: ActivityAction;
  target_type?: string;
  target_id?: string;
  details?: string;
}) {
  try {
    const res = await fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok && process.env.NODE_ENV !== "production") {
      console.warn("Activity log failed:", res.status, await res.text());
    }
  } catch {
    // Silently fail - activity logging should not break the app
  }
}
