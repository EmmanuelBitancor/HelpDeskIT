export async function logActivity(params: {
  action: string;
  target_type?: string;
  target_id?: string;
  details?: string;
}) {
  try {
    await fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...params,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      }),
    });
  } catch {
    // Silently fail - activity logging should not break the app
  }
}
