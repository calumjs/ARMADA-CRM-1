/**
 * Domain helpers for Voyages (deals). Kept free of Prisma imports so they are
 * trivially unit-testable and reusable on both server and client.
 */

import { z } from "zod";

export type VoyageStage =
  | "CHARTED"
  | "PROVISIONED"
  | "UNDERWAY"
  | "BOARDING"
  | "ANCHORED"
  | "WRECKED";

export const VOYAGE_STAGES: VoyageStage[] = [
  "CHARTED",
  "PROVISIONED",
  "UNDERWAY",
  "BOARDING",
  "ANCHORED",
  "WRECKED",
];

export interface StageMeta {
  /** Human-facing label for the stage. */
  label: string;
  /** Short description of what the stage means. */
  description: string;
  /** Signal-flag accent token used to colour the stage. */
  accent: "blue" | "yellow" | "green" | "red" | "white";
  /** Whether a voyage in this stage is still open (in flight). */
  open: boolean;
  /**
   * Static probability (0-100) of a voyage in this stage reaching ANCHORED.
   * Used for the board's weighted forecast; the navigator issue refines it.
   */
  probability: number;
}

export const STAGE_META: Record<VoyageStage, StageMeta> = {
  CHARTED: {
    label: "Charted",
    description: "A course is plotted; the voyage is a fresh lead.",
    accent: "blue",
    open: true,
    probability: 10,
  },
  PROVISIONED: {
    label: "Provisioned",
    description: "Qualified and stocked; needs and budget confirmed.",
    accent: "blue",
    open: true,
    probability: 30,
  },
  UNDERWAY: {
    label: "Underway",
    description: "Actively sailing; a proposal is in the water.",
    accent: "yellow",
    open: true,
    probability: 55,
  },
  BOARDING: {
    label: "Boarding",
    description: "Negotiation underway; terms being agreed.",
    accent: "yellow",
    open: true,
    probability: 80,
  },
  ANCHORED: {
    label: "Anchored",
    description: "Safely in port — the deal is won.",
    accent: "green",
    open: false,
    probability: 100,
  },
  WRECKED: {
    label: "Wrecked",
    description: "Lost at sea — the deal did not close.",
    accent: "red",
    open: false,
    probability: 0,
  },
};

/** Return the display metadata for a stage. */
export function stageMeta(stage: VoyageStage): StageMeta {
  return STAGE_META[stage];
}

/** True when a voyage in this stage is still in flight. */
export function isOpenStage(stage: VoyageStage): boolean {
  return STAGE_META[stage].open;
}

/** The static win-likelihood (0-100) the fleet assigns to a stage. */
export function stageProbability(stage: VoyageStage): number {
  return STAGE_META[stage].probability;
}

/**
 * Format a whole-unit currency amount the way the fleet's UI displays values.
 * No fractional pence — voyages are tracked in whole units.
 */
export function formatValue(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Total expected value of a set of voyages, optionally weighting each by its
 * probability of closing (0-100).
 */
export function weightedPipeline(
  voyages: { value: number; probability: number; stage: VoyageStage }[],
  { weighted = false, openOnly = true } = {},
): number {
  return voyages
    .filter((v) => (openOnly ? isOpenStage(v.stage) : true))
    .reduce(
      (sum, v) => sum + (weighted ? v.value * (v.probability / 100) : v.value),
      0,
    );
}

/** A health reading for a voyage card — colour + label for the indicator dot. */
export type VoyageHealth = "healthy" | "watch" | "stalled" | "closed";

export interface HealthMeta {
  health: VoyageHealth;
  label: string;
  /** Signal-flag accent token used to colour the indicator. */
  accent: "green" | "yellow" | "red" | "white";
}

/**
 * Read a voyage's health from its stage and expected-close date. Closed
 * voyages report their outcome; open voyages are stalled when overdue, on
 * watch when closing within a week, otherwise healthy. Pure and deterministic
 * given `now` so it is easy to unit-test.
 */
export function voyageHealth(
  voyage: { stage: VoyageStage; expectedClose: Date | string | null },
  now: Date = new Date(),
): HealthMeta {
  if (!isOpenStage(voyage.stage)) {
    return voyage.stage === "ANCHORED"
      ? { health: "closed", label: "Anchored", accent: "green" }
      : { health: "closed", label: "Wrecked", accent: "red" };
  }
  if (!voyage.expectedClose) {
    return { health: "healthy", label: "On course", accent: "green" };
  }
  const close =
    typeof voyage.expectedClose === "string"
      ? new Date(voyage.expectedClose)
      : voyage.expectedClose;
  const days = Math.ceil((close.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) {
    return { health: "stalled", label: "Overdue", accent: "red" };
  }
  if (days <= 7) {
    return { health: "watch", label: "Closing soon", accent: "yellow" };
  }
  return { health: "healthy", label: "On course", accent: "green" };
}

/** Headline figures for the board summary bar. */
export interface BoardSummary {
  /** Total value of every open (in-flight) voyage. */
  pipeline: number;
  /** Open value weighted by each stage's static probability. */
  forecast: number;
  /** Won ÷ (won + lost) as a 0-1 fraction; 0 when nothing has closed. */
  winRate: number;
  /** Count of voyages won (ANCHORED). */
  won: number;
  /** Count of voyages lost (WRECKED). */
  lost: number;
  /** Count of voyages still in flight. */
  open: number;
}

/**
 * Roll a set of voyages up into the board summary: total pipeline value,
 * weighted forecast (value × the stage's static probability), and win rate.
 */
export function boardSummary(
  voyages: { value: number; stage: VoyageStage }[],
): BoardSummary {
  let pipeline = 0;
  let forecast = 0;
  let won = 0;
  let lost = 0;
  let open = 0;
  for (const v of voyages) {
    if (isOpenStage(v.stage)) {
      open += 1;
      pipeline += v.value;
      forecast += v.value * (stageProbability(v.stage) / 100);
    } else if (v.stage === "ANCHORED") {
      won += 1;
    } else {
      lost += 1;
    }
  }
  const closed = won + lost;
  return {
    pipeline,
    forecast: Math.round(forecast),
    winRate: closed === 0 ? 0 : won / closed,
    won,
    lost,
    open,
  };
}

/** Format a 0-1 fraction as a whole-number percentage, e.g. "62%". */
export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

// ── Validation ─────────────────────────────────────────────────────────────

const stageEnum = z.enum([
  "CHARTED",
  "PROVISIONED",
  "UNDERWAY",
  "BOARDING",
  "ANCHORED",
  "WRECKED",
]);

const optionalVoyageText = z
  .string()
  .trim()
  .max(2000, "That's a touch long for this field.")
  .nullish()
  .transform((v) => (v && v.length > 0 ? v : null));

/** A blank/optional id from a <select> persists as `null`, not `""`. */
const optionalId = z
  .string()
  .nullish()
  .transform((v) => (v && v.length > 0 ? v : null));

/**
 * An expected-close date arriving from a form's date input as `YYYY-MM-DD`
 * (or blank). Blank → `null`; a value coerces to a `Date` at UTC midnight.
 */
const optionalCloseDate = z
  .string()
  .nullish()
  .transform((v) => (v && v.length > 0 ? v : null))
  .refine((v) => v === null || !Number.isNaN(Date.parse(v)), {
    message: "That doesn't look like a valid date.",
  })
  .transform((v) => (v === null ? null : new Date(v)));

/** Validation schema for creating or editing a Voyage. */
export const voyageSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "A voyage needs a name.")
    .max(200, "That name is too long."),
  stage: stageEnum,
  value: z.coerce
    .number()
    .int("Use whole units.")
    .min(0, "Value can't be negative.")
    .max(1_000_000_000, "That value is too large."),
  expectedClose: optionalCloseDate,
  portId: optionalId,
  captainId: optionalId,
  notes: optionalVoyageText,
});

/** Input shape accepted by the Voyage form (before transform). */
export type VoyageFormValues = z.input<typeof voyageSchema>;
/** Parsed, persist-ready Voyage values (after transform). */
export type VoyageInput = z.output<typeof voyageSchema>;
