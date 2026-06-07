/**
 * Display helpers and validation for Activities (the Log). Pure and Prisma-free
 * so they can be unit-tested and used on the client.
 */

import { z } from "zod";
import {
  Mail,
  MessageSquare,
  Phone,
  ScrollText,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ActivityType = "NOTE" | "CALL" | "EMAIL" | "MEETING" | "TASK";

export const ACTIVITY_TYPES: ActivityType[] = [
  "NOTE",
  "CALL",
  "EMAIL",
  "MEETING",
  "TASK",
];

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  NOTE: "Note",
  CALL: "Call",
  EMAIL: "Email",
  MEETING: "Meeting",
  TASK: "Task",
};

/** The icon the Log uses for each activity type. */
export const ACTIVITY_ICON: Record<ActivityType, LucideIcon> = {
  NOTE: ScrollText,
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Users,
  TASK: MessageSquare,
};

/** Which entity an activity is logged against. */
export type ActivityTarget = "port" | "captain" | "voyage";

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

/**
 * A task is overdue when it is still open and its due date is before the start
 * of today. Tasks with no due date are never overdue.
 */
export function isOverdue(
  task: { done: boolean; dueAt: Date | string | null },
  now: Date = new Date(),
): boolean {
  if (task.done || !task.dueAt) return false;
  const due =
    typeof task.dueAt === "string" ? new Date(task.dueAt) : task.dueAt;
  return startOfDay(due).getTime() < startOfDay(now).getTime();
}

/**
 * Sort open tasks for the Orders board: by due date ascending (soonest first),
 * tasks with no due date last, ties broken by creation order. Pure — returns a
 * new array.
 */
export function sortTasksByDue<
  T extends { dueAt: Date | string | null; createdAt: Date | string },
>(tasks: T[], dir: "asc" | "desc" = "asc"): T[] {
  const time = (v: Date | string | null): number | null =>
    v == null ? null : (typeof v === "string" ? new Date(v) : v).getTime();
  return [...tasks].sort((a, b) => {
    const da = time(a.dueAt);
    const db = time(b.dueAt);
    let result: number;
    if (da === null && db === null) {
      result = time(a.createdAt)! - time(b.createdAt)!;
    } else if (da === null) {
      return 1; // no-due always sinks to the bottom regardless of direction
    } else if (db === null) {
      return -1;
    } else {
      result = da - db;
    }
    return dir === "asc" ? result : -result;
  });
}

/**
 * Validation schema for logging an Activity from a composer. `dueAt` is an
 * optional ISO date string (date input); blank becomes null.
 */
export const activitySchema = z
  .object({
    type: z.enum(["NOTE", "CALL", "EMAIL", "MEETING", "TASK"]),
    subject: z
      .string()
      .trim()
      .min(1, "An activity needs a subject.")
      .max(200, "That subject is too long."),
    body: z
      .string()
      .trim()
      .max(2000, "That's a touch long for a log entry.")
      .nullish()
      .transform((v) => (v && v.length > 0 ? v : null)),
    dueAt: z
      .string()
      .nullish()
      .transform((v) => (v && v.length > 0 ? v : null)),
    /** Exactly one of these identifies the target the activity hangs off. */
    portId: z.string().nullish(),
    captainId: z.string().nullish(),
    voyageId: z.string().nullish(),
  })
  .refine(
    (v) => Boolean(v.portId || v.captainId || v.voyageId),
    "An activity must be logged against a port, captain, or voyage.",
  );

/** Input shape accepted by the composer (before transform). */
export type ActivityFormValues = z.input<typeof activitySchema>;
/** Parsed, persist-ready Activity values (after transform). */
export type ActivityInput = z.output<typeof activitySchema>;

/** A Prisma-row-ish activity with its optional captain, as loaded for a page. */
interface ActivityRow {
  id: string;
  type: string;
  subject: string;
  body: string | null;
  occurredAt: Date | string;
  done: boolean;
  dueAt: Date | string | null;
  captain?: { firstName: string; lastName: string } | null;
}

/**
 * Map a loaded activity row to the serialisable shape the timeline expects.
 * Dates become ISO strings so the payload crosses the server/client boundary
 * cleanly.
 */
export function toTimelineActivity(a: ActivityRow): {
  id: string;
  type: ActivityType;
  subject: string;
  body: string | null;
  occurredAt: string;
  done: boolean;
  dueAt: string | null;
  author: string | null;
} {
  const iso = (d: Date | string | null): string | null =>
    d == null ? null : (typeof d === "string" ? new Date(d) : d).toISOString();
  return {
    id: a.id,
    type: a.type as ActivityType,
    subject: a.subject,
    body: a.body,
    occurredAt: iso(a.occurredAt)!,
    done: a.done,
    dueAt: iso(a.dueAt),
    author: a.captain ? `${a.captain.firstName} ${a.captain.lastName}` : null,
  };
}
