/**
 * Domain helpers for The Chart — the living Fleet Chart sea-map.
 *
 * Kept free of Prisma (and React) imports so the geometry is trivially
 * unit-testable and runs the same on the server and the client. The chart is
 * deterministic: given the same seed and the same voyages it always lays the
 * fleet out in the same place, so the coastline and each ship's lane are stable
 * run-to-run (à la spyglass).
 */

import {
  STAGE_META,
  isOpenStage,
  voyageHealth,
  type VoyageStage,
} from "./voyage";

/** The minimal voyage shape the chart needs to place a ship. */
export interface ChartVoyage {
  id: string;
  name: string;
  stage: VoyageStage;
  value: number;
  expectedClose: string | null;
  portName: string | null;
}

/** A voyage resolved to a drawable ship on the chart. */
export interface ChartShip {
  id: string;
  name: string;
  stage: VoyageStage;
  stageLabel: string;
  value: number;
  portName: string | null;
  expectedClose: string | null;
  /** 0-1 across the chart: 0 = far out to sea (Charted), 1 = in harbour. */
  progress: number;
  /** Pixel centre of the ship's hull. */
  x: number;
  y: number;
  /** Hull half-length in px, scaled by value. */
  size: number;
  /** Health reading → weather: calm seas vs a storm. */
  health: "healthy" | "watch" | "stalled" | "closed";
  weather: "calm" | "fair" | "stormy";
  /** Signal-flag accent token for the hull/sail colour. */
  accent: "green" | "yellow" | "red" | "white";
  /** A per-ship phase (0-1) so ambient bob/drift is desynchronised. */
  phase: number;
}

/** Default logical drawing surface; the SVG scales to fit via viewBox. */
export const CHART_WIDTH = 1000;
export const CHART_HEIGHT = 600;

// ── Seeded pseudo-randomness ────────────────────────────────────────────────

/** Hash an arbitrary string to a 32-bit unsigned int (FNV-1a). */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * mulberry32 — a tiny, fast, well-distributed seeded PRNG. Returns a function
 * yielding deterministic floats in [0, 1). Seeding from the same value always
 * produces the same stream, which is what keeps the chart stable.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A deterministic PRNG seeded from a string. */
export function seededRng(seed: string): () => number {
  return mulberry32(hashSeed(seed));
}

// ── Coastline ───────────────────────────────────────────────────────────────

/**
 * Build an SVG path for the harbour coastline on the right-hand side of the
 * chart. Procedurally generated from `seed` so it is consistent run-to-run but
 * varies between repos/datasets. The path encloses the land mass (right edge +
 * a wavering shoreline) so it can be filled.
 */
export function coastlinePath(
  seed: string,
  width = CHART_WIDTH,
  height = CHART_HEIGHT,
): string {
  const rng = seededRng(`coastline:${seed}`);
  // The shoreline wanders around this x, leaving open sea to its left.
  const baseX = width * 0.72;
  const amplitude = width * 0.06;
  const steps = 10;
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const y = (height / steps) * i;
    // A couple of summed sines + jitter give an irregular but smooth shore.
    const wobble =
      Math.sin(i * 0.9 + rng() * 6.28) * amplitude +
      Math.sin(i * 2.3 + rng() * 6.28) * (amplitude * 0.4);
    const x = baseX + wobble;
    points.push([x, y]);
  }
  // A small harbour notch — pull the shoreline left around mid-height so ships
  // have somewhere to anchor.
  const notch = Math.floor(steps * (0.4 + rng() * 0.2));
  if (points[notch]) points[notch][0] -= amplitude * 1.4;

  let d = `M ${width} 0`;
  d += ` L ${points[0][0].toFixed(1)} 0`;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i];
    const [px, py] = points[i - 1];
    // Smooth with a midpoint quadratic so the coast reads as a curve.
    const mx = (px + x) / 2;
    const my = (py + y) / 2;
    d += ` Q ${px.toFixed(1)} ${py.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last[0].toFixed(1)} ${height}`;
  d += ` L ${width} ${height} Z`;
  return d;
}

/** The mean shoreline x (the harbour line ships sail toward). */
export function harbourLineX(width = CHART_WIDTH): number {
  return width * 0.72;
}

// ── Ship placement ──────────────────────────────────────────────────────────

/**
 * How far along its journey a stage sits, 0 (far out to sea) → 1 (in harbour).
 * Charted is freshly sighted on the horizon; Anchored is tied up in port;
 * Wrecked drifts back out as a derelict. The order follows the pipeline.
 */
const STAGE_PROGRESS: Record<VoyageStage, number> = {
  CHARTED: 0.08,
  PROVISIONED: 0.3,
  UNDERWAY: 0.52,
  BOARDING: 0.74,
  ANCHORED: 0.95,
  WRECKED: 0.18,
};

/** Progress (0-1) toward harbour for a stage. */
export function stageProgress(stage: VoyageStage): number {
  return STAGE_PROGRESS[stage];
}

/** Scale a voyage's value to a hull half-length in px. */
export function shipSize(value: number): number {
  // Square-root scaling so a 100× larger deal isn't 100× the area; clamp so
  // tiny and whale-sized deals both stay legible.
  const v = Math.max(0, value);
  const size = 10 + Math.sqrt(v) * 0.14;
  return Math.min(34, Math.max(10, size));
}

/** Map a health reading to a weather band for the ship. */
export function weatherFor(
  health: "healthy" | "watch" | "stalled" | "closed",
): "calm" | "fair" | "stormy" {
  switch (health) {
    case "stalled":
      return "stormy";
    case "watch":
      return "fair";
    default:
      return "calm";
  }
}

/**
 * Place a single voyage on the chart. The x position is set by its stage
 * (Charted far out → Anchored in harbour); the y position is jittered by a
 * per-voyage seed so ships spread across the sea-lane instead of stacking.
 */
export function placeShip(
  voyage: ChartVoyage,
  seed: string,
  width = CHART_WIDTH,
  height = CHART_HEIGHT,
  now: Date = new Date(),
): ChartShip {
  const rng = seededRng(`ship:${seed}:${voyage.id}`);
  const progress = stageProgress(voyage.stage);

  // x: open sea on the left (progress 0) toward the harbour line on the right.
  const seaLeft = width * 0.06;
  const harbour = harbourLineX(width);
  const jitterX = (rng() - 0.5) * width * 0.05;
  const x = seaLeft + (harbour - seaLeft) * progress + jitterX;

  // y: spread vertically with a margin so hulls don't clip the edges.
  const margin = height * 0.12;
  const y = margin + rng() * (height - margin * 2);

  const { health, accent } = voyageHealth(
    {
      stage: voyage.stage,
      expectedClose: voyage.expectedClose,
    },
    now,
  );

  return {
    id: voyage.id,
    name: voyage.name,
    stage: voyage.stage,
    stageLabel: STAGE_META[voyage.stage].label,
    value: voyage.value,
    portName: voyage.portName,
    expectedClose: voyage.expectedClose,
    progress,
    x,
    y,
    size: shipSize(voyage.value),
    health,
    weather: weatherFor(health),
    accent,
    phase: rng(),
  };
}

/**
 * Lay an entire fleet out on the chart. By default only *active* (open)
 * voyages are charted as ships in flight — Anchored and Wrecked ones have left
 * the open sea — matching the acceptance criterion ("each active voyage").
 * Ships are sorted so larger hulls draw first (smaller ones on top) to keep
 * little ships from hiding behind big ones.
 */
export function layoutFleet(
  voyages: ChartVoyage[],
  seed: string,
  {
    width = CHART_WIDTH,
    height = CHART_HEIGHT,
    activeOnly = true,
    now = new Date(),
  }: {
    width?: number;
    height?: number;
    activeOnly?: boolean;
    now?: Date;
  } = {},
): ChartShip[] {
  return voyages
    .filter((v) => (activeOnly ? isOpenStage(v.stage) : true))
    .map((v) => placeShip(v, seed, width, height, now))
    .sort((a, b) => b.size - a.size);
}
