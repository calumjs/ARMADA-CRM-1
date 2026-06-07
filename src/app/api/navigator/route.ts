/**
 * The Navigator API — server-side AI calls for the co-pilot.
 *
 * All live model access happens here (and in `@/lib/ai`), never on the client,
 * so the AI Gateway key stays on the server. Inputs and outputs are typed, the
 * handler degrades gracefully without a key, and a small in-memory rate limiter
 * guards against accidental hammering.
 *
 * POST body: { task, voyageId?, portId? }
 *  - task "next-action" | "summarise": returns { text } (JSON).
 *  - task "draft-follow-up": returns a streamed text/plain body (or a JSON
 *    fallback message when no key is configured).
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { runNavigator, streamNavigator } from "@/lib/ai";
import { captainName } from "@/lib/ports";
import {
  NO_KEY_MESSAGE,
  buildPortSummaryPrompt,
  buildVoyagePrompt,
  hasGatewayKey,
  type PortSnapshot,
  type VoyageSnapshot,
} from "@/lib/navigator";
import type { VoyageStage } from "@/lib/voyage";

export const dynamic = "force-dynamic";

const requestSchema = z
  .object({
    task: z.enum(["next-action", "draft-follow-up", "summarise"]),
    voyageId: z.string().min(1).optional(),
    portId: z.string().min(1).optional(),
  })
  .refine((b) => Boolean(b.voyageId || b.portId), {
    message: "A voyageId or portId is required.",
  });

// ── Rate limiting ────────────────────────────────────────────────────────────
// A deliberately simple per-process token bucket keyed by client IP. Enough to
// stop a runaway loop hammering the model; not a distributed limiter.
const RATE_LIMIT = 12;
const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > RATE_LIMIT;
}

function clientKey(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

async function loadVoyageSnapshot(id: string): Promise<VoyageSnapshot | null> {
  const v = await prisma.voyage.findUnique({
    where: { id },
    include: {
      port: true,
      captain: true,
      activities: {
        orderBy: { occurredAt: "desc" },
        take: 12,
        include: { captain: true },
      },
    },
  });
  if (!v) return null;
  return {
    name: v.name,
    stage: v.stage as VoyageStage,
    value: v.value,
    expectedClose: v.expectedClose,
    portName: v.port?.name ?? null,
    captainName: v.captain ? captainName(v.captain) : null,
    notes: v.notes,
    activities: v.activities.map((a) => ({
      type: a.type,
      subject: a.subject,
      occurredAt: a.occurredAt,
    })),
  };
}

async function loadPortSnapshot(id: string): Promise<PortSnapshot | null> {
  const p = await prisma.port.findUnique({
    where: { id },
    include: {
      voyages: { orderBy: { value: "desc" } },
      activities: { orderBy: { occurredAt: "desc" }, take: 12 },
    },
  });
  if (!p) return null;
  return {
    name: p.name,
    industry: p.industry,
    voyages: p.voyages.map((v) => ({
      name: v.name,
      stage: v.stage as VoyageStage,
      value: v.value,
    })),
    activities: p.activities.map((a) => ({
      type: a.type,
      subject: a.subject,
      occurredAt: a.occurredAt,
    })),
  };
}

/** Build the prompt for the request, or a typed error if the target is missing. */
async function buildPrompt(
  body: z.infer<typeof requestSchema>,
): Promise<
  { ok: true; prompt: string } | { ok: false; status: number; error: string }
> {
  try {
    if (body.task === "summarise" && body.portId) {
      const port = await loadPortSnapshot(body.portId);
      if (!port) return { ok: false, status: 404, error: "Port not found." };
      return { ok: true, prompt: buildPortSummaryPrompt(port) };
    }
    if (!body.voyageId) {
      return { ok: false, status: 400, error: "A voyageId is required." };
    }
    const voyage = await loadVoyageSnapshot(body.voyageId);
    if (!voyage) return { ok: false, status: 404, error: "Voyage not found." };
    return { ok: true, prompt: buildVoyagePrompt(body.task, voyage) };
  } catch (err) {
    console.error("[navigator] failed to load context:", err);
    return { ok: false, status: 500, error: "Couldn't read the charts." };
  }
}

export async function POST(req: Request) {
  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (rateLimited(clientKey(req))) {
    return NextResponse.json(
      { error: "Easy there — too many requests. Try again in a moment." },
      { status: 429 },
    );
  }

  const built = await buildPrompt(parsed);
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: built.status });
  }

  // Streamed task: hand back a text stream, or a graceful no-key message.
  if (parsed.task === "draft-follow-up") {
    const stream = streamNavigator(built.prompt);
    if (!stream) {
      return NextResponse.json(
        { error: NO_KEY_MESSAGE, code: "no-key" },
        { status: 200 },
      );
    }
    return stream;
  }

  // Non-streamed tasks.
  const result = await runNavigator(built.prompt);
  if (!result.ok) {
    const status = result.code === "no-key" ? 200 : 502;
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status },
    );
  }
  return NextResponse.json({ text: result.text });
}

/** Report whether the navigator is configured, so the UI can hint up-front. */
export async function GET() {
  return NextResponse.json({ configured: hasGatewayKey() });
}
