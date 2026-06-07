/**
 * Domain helpers for Voyages (deals). Kept free of Prisma imports so they are
 * trivially unit-testable and reusable on both server and client.
 */

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
}

export const STAGE_META: Record<VoyageStage, StageMeta> = {
  CHARTED: {
    label: "Charted",
    description: "A course is plotted; the voyage is a fresh lead.",
    accent: "blue",
    open: true,
  },
  PROVISIONED: {
    label: "Provisioned",
    description: "Qualified and stocked; needs and budget confirmed.",
    accent: "blue",
    open: true,
  },
  UNDERWAY: {
    label: "Underway",
    description: "Actively sailing; a proposal is in the water.",
    accent: "yellow",
    open: true,
  },
  BOARDING: {
    label: "Boarding",
    description: "Negotiation underway; terms being agreed.",
    accent: "yellow",
    open: true,
  },
  ANCHORED: {
    label: "Anchored",
    description: "Safely in port — the deal is won.",
    accent: "green",
    open: false,
  },
  WRECKED: {
    label: "Wrecked",
    description: "Lost at sea — the deal did not close.",
    accent: "red",
    open: false,
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
