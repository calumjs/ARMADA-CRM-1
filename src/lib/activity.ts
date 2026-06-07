/**
 * Display helpers for Activities (the Log). Pure and Prisma-free so they can be
 * unit-tested and used on the client.
 */

export type ActivityType = "NOTE" | "CALL" | "EMAIL" | "MEETING" | "TASK";

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  NOTE: "Note",
  CALL: "Call",
  EMAIL: "Email",
  MEETING: "Meeting",
  TASK: "Task",
};

/** Format a date the way the fleet's UI shows activity timestamps. */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** A short relative-ish label, e.g. "Today", "Yesterday", or the date. */
export function formatWhen(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const today = new Date();
  const days = Math.round(
    (startOfDay(today).getTime() - startOfDay(d).getTime()) / 86_400_000,
  );
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days === -1) return "Tomorrow";
  return formatDate(d);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
