/**
 * Domain helpers and validation schemas for Ports (companies) and Captains
 * (contacts). Kept free of Prisma imports so they are trivially unit-testable
 * and reusable on both the server and the client.
 */

import { z } from "zod";

import type { VoyageStage } from "./voyage";
import { isOpenStage } from "./voyage";

/**
 * A blank string from a form field should persist as `null`, not `""`. Accepts
 * `null`/`undefined` too, so already-normalised values round-trip cleanly back
 * through the schema (the server actions re-validate persist-ready input).
 */
const optionalText = z
  .string()
  .trim()
  .max(2000, "That's a touch long for this field.")
  .nullish()
  .transform((v) => (v && v.length > 0 ? v : null));

/** Optional email — blank is allowed, but a non-blank value must be valid. */
const optionalEmail = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v && v.length > 0 ? v : null))
  .refine((v) => v === null || z.string().email().safeParse(v).success, {
    message: "That doesn't look like a valid email.",
  });

/** Validation schema for creating or editing a Port. */
export const portSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "A port needs a name.")
    .max(200, "That name is too long."),
  industry: optionalText,
  website: optionalText,
  location: optionalText,
  notes: optionalText,
});

/** Input shape accepted by the Port form (before transform). */
export type PortFormValues = z.input<typeof portSchema>;
/** Parsed, persist-ready Port values (after transform). */
export type PortInput = z.output<typeof portSchema>;

/** Validation schema for creating or editing a Captain. */
export const captainSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "A captain needs a first name.")
    .max(100, "That first name is too long."),
  lastName: z
    .string()
    .trim()
    .min(1, "A captain needs a last name.")
    .max(100, "That last name is too long."),
  email: optionalEmail,
  phone: optionalText,
  title: optionalText,
  notes: optionalText,
  /** The Port this captain sails for. Empty string / null = unassigned. */
  portId: z
    .string()
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type CaptainFormValues = z.input<typeof captainSchema>;
export type CaptainInput = z.output<typeof captainSchema>;

/** The columns the Ports list can be sorted by. */
export type PortSortKey = "name" | "industry" | "captains" | "openVoyages";

/** The columns the Captains list can be sorted by. */
export type CaptainSortKey = "name" | "title" | "email" | "port";

export type SortDirection = "asc" | "desc";

/** A captain's display name — "First Last". */
export function captainName(c: {
  firstName: string;
  lastName: string;
}): string {
  return `${c.firstName} ${c.lastName}`.trim();
}

/** Two-letter initials for an avatar fallback. */
export function captainInitials(c: {
  firstName: string;
  lastName: string;
}): string {
  const first = c.firstName.charAt(0);
  const last = c.lastName.charAt(0);
  return `${first}${last}`.toUpperCase() || "??";
}

/** Count the voyages of a port that are still in flight (open stages). */
export function countOpenVoyages(
  voyages: { stage: VoyageStage | string }[],
): number {
  return voyages.filter((v) => isOpenStage(v.stage as VoyageStage)).length;
}

/**
 * Case-insensitive, accent-tolerant haystack match used by the list search
 * boxes. Returns true when every field, joined, contains the query.
 */
export function matchesQuery(
  fields: (string | null | undefined)[],
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return true;
  return fields.filter(Boolean).join(" ").toLowerCase().includes(q);
}

/**
 * Generic comparison for sorting. Numbers compare numerically, everything else
 * by locale-aware string order; `dir` flips the result.
 */
export function compareBy(
  a: string | number,
  b: string | number,
  dir: SortDirection,
): number {
  let result: number;
  if (typeof a === "number" && typeof b === "number") {
    result = a - b;
  } else {
    result = String(a).localeCompare(String(b), undefined, {
      sensitivity: "base",
    });
  }
  return dir === "asc" ? result : -result;
}
