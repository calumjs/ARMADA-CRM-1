/**
 * The Navigator — the fleet's AI co-pilot.
 *
 * This module holds the *pure* navigator logic: the deal-health ("reading the
 * tides") score, the deterministic next-best-action heuristic, and the prompt
 * builders. It imports no Prisma and makes no live model calls, so it is
 * trivially unit-testable and safe to import from anywhere (server or client).
 *
 * The single source of truth for every prompt lives here — the server-side AI
 * wrapper (`src/lib/ai.ts`) and the route handler only stitch these strings to
 * the model. Keep all prompt copy in this file.
 */

import {
  STAGE_META,
  isOpenStage,
  formatValue,
  type VoyageStage,
} from "./voyage";

// ── Model + key ──────────────────────────────────────────────────────────────

/**
 * The AI Gateway model string. A plain `"provider/model"` string (per Vercel
 * guidance) — *not* a provider-specific SDK package — so the provider can be
 * swapped via env without a code change. Overridable with `NAVIGATOR_MODEL`.
 */
export const NAVIGATOR_MODEL =
  process.env.NAVIGATOR_MODEL ?? "anthropic/claude-sonnet-4.5";

/**
 * True when an AI Gateway key is configured. When false the navigator degrades
 * gracefully — the UI shows a clear "no key" message and the build/CI stay
 * green without ever reaching a live model.
 */
export function hasGatewayKey(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.AI_GATEWAY_API_KEY?.trim() || env.VERCEL_OIDC_TOKEN?.trim(),
  );
}

/** The message shown wherever the navigator can't run for lack of a key. */
export const NO_KEY_MESSAGE =
  "The Navigator is becalmed — no AI Gateway key is configured. Set AI_GATEWAY_API_KEY to let it sail.";

// ── Reading the tides: deal-health score ─────────────────────────────────────

/** A voyage's facts the navigator reasons over. Prisma-free and serialisable. */
export interface VoyageSnapshot {
  name: string;
  stage: VoyageStage;
  value: number;
  expectedClose: Date | string | null;
  portName?: string | null;
  captainName?: string | null;
  notes?: string | null;
  /** Most-recent-first activity entries logged against the voyage. */
  activities?: ActivitySnapshot[];
}

export interface ActivitySnapshot {
  type: string;
  subject: string;
  occurredAt: Date | string;
}

/** A 0-100 deal-health reading plus a short, human rationale. */
export interface TidesReading {
  /** Deal-health score, 0 (sinking) to 100 (safely in port). */
  score: number;
  /** One-line plain-English explanation of the score. */
  rationale: string;
  /** Signal-flag accent token for the UI, derived from the score band. */
  accent: "green" | "yellow" | "red";
  /** Coarse band label for badges. */
  band: "Strong" | "Watch" | "At risk";
}

const DAY_MS = 86_400_000;

function toDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/**
 * Read a voyage's health as a 0-100 score with a rationale ("reading the
 * tides"). Deterministic given `now`, so it unit-tests without a live model.
 *
 * The score starts from the stage's static win probability and is nudged by
 * three real signals: how overdue / imminent the expected close is, how fresh
 * the last activity is, and how much recent activity there has been. Closed
 * voyages report their settled outcome (won = 100, wrecked = 0).
 */
export function tidesScore(
  voyage: VoyageSnapshot,
  now: Date = new Date(),
): TidesReading {
  if (!isOpenStage(voyage.stage)) {
    return voyage.stage === "ANCHORED"
      ? {
          score: 100,
          rationale: "Anchored — the deal is safely won.",
          accent: "green",
          band: "Strong",
        }
      : {
          score: 0,
          rationale: "Wrecked — this voyage was lost.",
          accent: "red",
          band: "At risk",
        };
  }

  const reasons: string[] = [];
  let score = STAGE_META[voyage.stage].probability;
  reasons.push(`${STAGE_META[voyage.stage].label} stage`);

  // Expected-close pressure.
  if (voyage.expectedClose) {
    const days = daysBetween(now, toDate(voyage.expectedClose));
    if (days < 0) {
      score -= 25;
      reasons.push(`${Math.abs(days)}d overdue`);
    } else if (days <= 7) {
      score -= 5;
      reasons.push(`closing in ${days}d`);
    } else if (days <= 30) {
      score += 5;
      reasons.push("close date in sight");
    }
  } else {
    score -= 5;
    reasons.push("no close date set");
  }

  // Activity recency + volume.
  const activities = voyage.activities ?? [];
  if (activities.length === 0) {
    score -= 15;
    reasons.push("no activity logged");
  } else {
    const last = toDate(activities[0].occurredAt);
    const sinceDays = daysBetween(last, now);
    if (sinceDays <= 7) {
      score += 12;
      reasons.push("recent contact");
    } else if (sinceDays <= 21) {
      score += 3;
      reasons.push(`last touch ${sinceDays}d ago`);
    } else {
      score -= 15;
      reasons.push(`quiet for ${sinceDays}d`);
    }
    if (activities.length >= 4) {
      score += 5;
      reasons.push("strong engagement");
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const accent: TidesReading["accent"] =
    score >= 66 ? "green" : score >= 40 ? "yellow" : "red";
  const band: TidesReading["band"] =
    score >= 66 ? "Strong" : score >= 40 ? "Watch" : "At risk";

  return {
    score,
    rationale: capitalise(reasons.join("; ")) + ".",
    accent,
    band,
  };
}

/**
 * A deterministic next-best-action suggestion. This is the offline fallback the
 * panel shows without a key, and the seed the model refines when a key exists.
 */
export function nextBestAction(
  voyage: VoyageSnapshot,
  now: Date = new Date(),
): string {
  if (!isOpenStage(voyage.stage)) {
    return voyage.stage === "ANCHORED"
      ? "Voyage anchored — log the win and look for follow-on cargo at this port."
      : "Voyage wrecked — capture why it was lost so the next one sails truer.";
  }

  const activities = voyage.activities ?? [];
  if (activities.length === 0) {
    return "No activity yet — open with a discovery call to learn what this port needs.";
  }
  const sinceDays = daysBetween(toDate(activities[0].occurredAt), now);
  if (sinceDays > 21) {
    return `It's been ${sinceDays} days since the last contact — send a check-in to keep the wind in the sails.`;
  }
  if (voyage.expectedClose) {
    const days = daysBetween(now, toDate(voyage.expectedClose));
    if (days < 0) {
      return "Expected close has passed — confirm the timeline or move the date so the forecast stays honest.";
    }
    if (days <= 7) {
      return "Close is imminent — send the agreement and ask for a date to sign.";
    }
  }

  switch (voyage.stage) {
    case "CHARTED":
      return "Qualify the need and budget so this voyage can be provisioned.";
    case "PROVISIONED":
      return "Get a proposal in the water to move the voyage underway.";
    case "UNDERWAY":
      return "Chase feedback on the proposal and surface any objections early.";
    case "BOARDING":
      return "Lock the terms — agree price and close date to bring it into port.";
    default:
      return "Keep momentum with a timely follow-up.";
  }
}

// ── Prompt builders ──────────────────────────────────────────────────────────

/** The kind of help the navigator can offer. Drives prompt selection + routing. */
export type NavigatorTask = "next-action" | "draft-follow-up" | "summarise";

/** The shared system prompt — the navigator's voice and guard-rails. */
export const SYSTEM_PROMPT = [
  "You are the Navigator, an AI co-pilot inside ARMADA, a sales CRM that uses a",
  "nautical metaphor (a Voyage is a deal, a Port is a company, a Captain is a",
  "contact, an Activity is a logged interaction). Be concise, concrete, and",
  "practical for a busy salesperson. Never invent facts not present in the",
  "context. A light nautical turn of phrase is welcome, but clarity comes first.",
].join(" ");

function renderVoyage(v: VoyageSnapshot, now: Date): string {
  const lines = [
    `Voyage: ${v.name}`,
    `Stage: ${STAGE_META[v.stage].label} (${STAGE_META[v.stage].description})`,
    `Value: ${formatValue(v.value)}`,
  ];
  if (v.portName) lines.push(`Port (company): ${v.portName}`);
  if (v.captainName) lines.push(`Captain (contact): ${v.captainName}`);
  if (v.expectedClose) {
    const days = daysBetween(now, toDate(v.expectedClose));
    const rel = days < 0 ? `${Math.abs(days)} days overdue` : `in ${days} days`;
    lines.push(`Expected close: ${rel}`);
  }
  if (v.notes) lines.push(`Notes: ${v.notes}`);
  lines.push(`Tides (deal-health): ${tidesScore(v, now).score}/100`);
  lines.push(renderActivities(v.activities ?? [], now));
  return lines.join("\n");
}

function renderActivities(activities: ActivitySnapshot[], now: Date): string {
  if (activities.length === 0) return "Recent activity: none logged.";
  const rows = activities
    .slice(0, 12)
    .map((a) => {
      const days = daysBetween(toDate(a.occurredAt), now);
      const when = days <= 0 ? "today" : `${days}d ago`;
      return `- [${a.type}] ${a.subject} (${when})`;
    })
    .join("\n");
  return `Recent activity (newest first):\n${rows}`;
}

/** Build the prompt for the requested navigator task over a single voyage. */
export function buildVoyagePrompt(
  task: NavigatorTask,
  voyage: VoyageSnapshot,
  now: Date = new Date(),
): string {
  const context = renderVoyage(voyage, now);
  switch (task) {
    case "next-action":
      return [
        "Given the voyage below, suggest the single best next action to move it",
        "forward. One or two sentences, imperative voice, specific to the",
        "context. Do not restate the facts.",
        "",
        context,
      ].join("\n");
    case "draft-follow-up":
      return [
        "Draft a short, warm, professional follow-up email for the voyage below.",
        "Address the captain by first name if known. Reference the most recent",
        "activity, advance the deal toward its next stage, and end with a clear",
        "ask. Plain text, no subject line longer than one line. Keep it under 150",
        "words.",
        "",
        context,
      ].join("\n");
    case "summarise":
      return [
        "Summarise this voyage's history in 3-4 sentences: where it stands, the",
        "recent activity, and what's outstanding. Neutral, factual, scannable.",
        "",
        context,
      ].join("\n");
  }
}

/** A port (company) and the activity across its voyages, for summarising. */
export interface PortSnapshot {
  name: string;
  industry?: string | null;
  voyages: { name: string; stage: VoyageStage; value: number }[];
  activities?: ActivitySnapshot[];
}

/** Build the prompt to summarise a whole port's history. */
export function buildPortSummaryPrompt(
  port: PortSnapshot,
  now: Date = new Date(),
): string {
  const open = port.voyages.filter((v) => isOpenStage(v.stage));
  const lines = [
    `Port (company): ${port.name}`,
    port.industry ? `Industry: ${port.industry}` : null,
    `Voyages: ${port.voyages.length} total, ${open.length} in flight.`,
    ...port.voyages.map(
      (v) =>
        `- ${v.name}: ${STAGE_META[v.stage].label}, ${formatValue(v.value)}`,
    ),
    renderActivities(port.activities ?? [], now),
  ].filter(Boolean);
  return [
    "Summarise this port's relationship in 3-4 sentences: the state of its",
    "voyages, recent engagement, and where attention is needed. Neutral and",
    "factual.",
    "",
    lines.join("\n"),
  ].join("\n");
}

function capitalise(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
