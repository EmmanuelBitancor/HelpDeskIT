import { NextResponse } from "next/server";

/**
 * Standard JSON response helper.
 */
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Standard error response.
 */
export function error(message: string, status = 400) {
  return json({ error: message }, status);
}

/**
 * 401 Unauthorized.
 */
export function unauthorized() {
  return error("Unauthorized", 401);
}

/**
 * 403 Forbidden.
 */
export function forbidden() {
  return error("Forbidden", 403);
}

/**
 * 404 Not Found.
 */
export function notFound(message = "Not found") {
  return error(message, 404);
}

/**
 * 500 Internal Server Error with optional log message.
 */
export function serverError(logMessage?: string) {
  if (logMessage) console.error(logMessage);
  return error("Internal server error", 500);
}

/**
 * 429 Rate Limited.
 */
export function rateLimited() {
  return error("Too many requests. Please try again later.", 429);
}
