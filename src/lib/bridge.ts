/**
 * Pure metric-aggregation helpers for the Bridge (command dashboard).
 *
 * Kept free of Prisma imports so they are trivially unit-testable and reusable
 * on both the server (loading the page) and the client (the chart components).
 * The Bridge page does the DB reads, then hands plain rows to these helpers.
 */

import {
  VOYAGE_STAGES,
  isOpenStage,
  stageMeta,
  stageProbability,
  type VoyageStage,
} from "./voyage";

/** The period a Bridge view is scoped to. */
export type BridgePeriod = "month" | "quarter" | "all";

/** Every period the filter offers, in display order. */
export const BRIDGE_PERIODS: BridgePeriod[] = ["month", "quarter", "all"];

/** Human-facing label for a period. */
export const PERIOD_LABEL: Record<BridgePeriod, string> = {
  month: "This month",
  quarter: "This quarter",
  all: "All time",
};

/** Coerce an arbitrary string (e.g. a `?period=` query param) to a period. */
export function parsePeriod(value: string | null | undefined): BridgePeriod {
  return value === "month" || value === "quarter" || value === "all"
    ? value
    : "month";
}

/**
 * The inclusive start of a period relative to `now`. `all` has no lower bound
 * so it returns `null`. The start is the first instant of the month / quarter.
 */
export function periodStart(period: BridgePeriod, now: Date = new Date()): Date | null {
  if (period === "all") return null;
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  // Quarter: snap back to the first month of the current calendar quarter.
  const quarterFirstMonth = Math.floor(now.getMonth() / 3) * 3;
  return new Date(now.getFullYear(), quarterFirstMonth, 1);
}

/** True when `date` falls within `period` relative to `now`. */
export function isInPeriod(
  date: Date | string | null,
  period: BridgePeriod,
  now: Date = new Date(),
): boolean {
  if (period === "all") return true;
  if (!date) return false;
  const d = typeof date === "string" ? new Date(date) : date;
  const start = periodStart(period, now);
  return start !== null && d.getTime() >= start.getTime() && d.getTime() <= now.getTime();
}

/** The minimal shape of a voyage the Bridge metrics need. */
export interface MetricVoyage {
  value: number;
  stage: VoyageStage;
  closedAt: Date | string | null;
  expectedClose: Date | string | null;
}

/** The headline KPIs the Bridge shows across the top. */
export interface BridgeMetrics {
  /** Total value of every open (in-flight) voyage — period-independent. */
  pipelineValue: number;
  /** Open value weighted by each stage's static probability. */
  weightedForecast: number;
  /** Count of voyages won (ANCHORED) whose close lands in the period. */
  voyagesWon: number;
  /** Won ÷ (won + lost) within the period, as a 0-1 fraction; 0 when nothing closed. */
  winRate: number;
  /** Value of the voyages won in the period. */
  wonValue: number;
}

/**
 * Roll a set of voyages up into the Bridge KPIs for a period.
 *
 * Pipeline value and weighted forecast describe the *current* open book and so
 * ignore the period (open deals haven't closed yet). Won count, won value, and
 * win rate are period-scoped: a closed voyage counts only when its `closedAt`
 * falls inside the period. Pure and deterministic given `now`.
 */
export function bridgeMetrics(
  voyages: MetricVoyage[],
  period: BridgePeriod = "all",
  now: Date = new Date(),
): BridgeMetrics {
  let pipelineValue = 0;
  let weightedForecast = 0;
  let voyagesWon = 0;
  let wonValue = 0;
  let lostInPeriod = 0;

  for (const v of voyages) {
    if (isOpenStage(v.stage)) {
      pipelineValue += v.value;
      weightedForecast += v.value * (stageProbability(v.stage) / 100);
      continue;
    }
    // Closed: only count it if it closed within the period.
    if (!isInPeriod(v.closedAt, period, now)) continue;
    if (v.stage === "ANCHORED") {
      voyagesWon += 1;
      wonValue += v.value;
    } else {
      lostInPeriod += 1;
    }
  }

  const closed = voyagesWon + lostInPeriod;
  return {
    pipelineValue,
    weightedForecast: Math.round(weightedForecast),
    voyagesWon,
    winRate: closed === 0 ? 0 : voyagesWon / closed,
    wonValue,
  };
}

/** One bar/slice of the pipeline-by-stage chart. */
export interface StageBucket {
  stage: VoyageStage;
  label: string;
  /** Number of open voyages sitting in this stage. */
  count: number;
  /** Combined value of those voyages. */
  value: number;
  /** A signal-flag accent token for colouring the bar. */
  accent: ReturnType<typeof stageMeta>["accent"];
}

/**
 * Bucket the *open* voyages by stage, in the canonical stage order, so the
 * pipeline funnel/bar chart always shows every open stage (zero-filled).
 */
export function pipelineByStage(
  voyages: { value: number; stage: VoyageStage }[],
): StageBucket[] {
  const open = VOYAGE_STAGES.filter((s) => isOpenStage(s));
  const counts = new Map<VoyageStage, { count: number; value: number }>();
  for (const s of open) counts.set(s, { count: 0, value: 0 });

  for (const v of voyages) {
    const bucket = counts.get(v.stage);
    if (!bucket) continue; // closed stage — not on the funnel
    bucket.count += 1;
    bucket.value += v.value;
  }

  return open.map((stage) => {
    const meta = stageMeta(stage);
    const b = counts.get(stage)!;
    return {
      stage,
      label: meta.label,
      count: b.count,
      value: b.value,
      accent: meta.accent,
    };
  });
}

/** One point on the voyages-won-over-time line chart. */
export interface WonOverTimePoint {
  /** `YYYY-MM` bucket key. */
  month: string;
  /** Short human label, e.g. "Mar 2026". */
  label: string;
  /** Voyages won (ANCHORED) that month. */
  won: number;
  /** Combined value won that month. */
  value: number;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Build a dense month-by-month series of voyages won, covering the last
 * `months` calendar months up to and including the month of `now` (so the line
 * chart has a continuous x-axis even for months with no wins). Only ANCHORED
 * voyages with a `closedAt` contribute.
 */
export function voyagesWonOverTime(
  voyages: { value: number; stage: VoyageStage; closedAt: Date | string | null }[],
  months = 6,
  now: Date = new Date(),
): WonOverTimePoint[] {
  // Seed an ordered, zero-filled bucket per month in range.
  const buckets = new Map<string, WonOverTimePoint>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.set(monthKey(d), {
      month: monthKey(d),
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
      won: 0,
      value: 0,
    });
  }

  for (const v of voyages) {
    if (v.stage !== "ANCHORED" || !v.closedAt) continue;
    const d = typeof v.closedAt === "string" ? new Date(v.closedAt) : v.closedAt;
    const point = buckets.get(monthKey(d));
    if (!point) continue; // outside the window
    point.won += 1;
    point.value += v.value;
  }

  return [...buckets.values()];
}

/** The minimal shape of a voyage the "needs attention" list scans. */
export interface AttentionVoyage {
  id: string;
  name: string;
  stage: VoyageStage;
  value: number;
  expectedClose: Date | string | null;
  updatedAt: Date | string;
  portName: string | null;
}

/** A voyage flagged as needing attention, with the reason why. */
export interface AttentionFlag extends AttentionVoyage {
  reason: "overdue" | "stalled";
  /** How many days past close (overdue) or since last touch (stalled). */
  days: number;
}

/**
 * Find open voyages needing attention: those past their expected close date
 * (overdue), or untouched for `stallDays` days (stalled). Overdue wins when a
 * voyage qualifies for both. Sorted most-overdue / most-stalled first. Pure and
 * deterministic given `now`.
 */
export function voyagesNeedingAttention(
  voyages: AttentionVoyage[],
  now: Date = new Date(),
  stallDays = 14,
): AttentionFlag[] {
  const flags: AttentionFlag[] = [];
  for (const v of voyages) {
    if (!isOpenStage(v.stage)) continue;

    if (v.expectedClose) {
      const close =
        typeof v.expectedClose === "string"
          ? new Date(v.expectedClose)
          : v.expectedClose;
      const overdueDays = Math.floor(
        (now.getTime() - close.getTime()) / 86_400_000,
      );
      if (overdueDays > 0) {
        flags.push({ ...v, reason: "overdue", days: overdueDays });
        continue;
      }
    }

    const updated =
      typeof v.updatedAt === "string" ? new Date(v.updatedAt) : v.updatedAt;
    const idleDays = Math.floor((now.getTime() - updated.getTime()) / 86_400_000);
    if (idleDays >= stallDays) {
      flags.push({ ...v, reason: "stalled", days: idleDays });
    }
  }
  return flags.sort((a, b) => b.days - a.days);
}
