"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import {
  VOYAGE_STAGES,
  isOpenStage,
  stageProbability,
  voyageSchema,
  type VoyageInput,
  type VoyageStage,
} from "@/lib/voyage";

/** The shape every mutation returns so the client can react uniformly. */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function parseVoyage(input: unknown) {
  const parsed = voyageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  return { ok: true as const, data: parsed.data };
}

function revalidateVoyages(id?: string) {
  revalidatePath("/voyages");
  revalidatePath("/ports");
  revalidatePath("/captains");
  revalidatePath("/");
  if (id) revalidatePath(`/voyages/${id}`);
}

/**
 * Derive the persisted fields that follow from a voyage's stage: its static
 * win probability, and when it closed (set on entering a closed stage, cleared
 * on returning to an open one).
 */
function stageDerived(stage: VoyageStage, closedAt: Date | null) {
  return {
    probability: stageProbability(stage),
    closedAt: isOpenStage(stage) ? null : (closedAt ?? new Date()),
  };
}

export async function createVoyage(
  input: VoyageInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = parseVoyage(input);
  if (!parsed.ok) return parsed;
  const { stage } = parsed.data;
  try {
    const voyage = await prisma.voyage.create({
      data: {
        ...parsed.data,
        ...stageDerived(stage, null),
        // The first stage event has no `from` — it's where the voyage began.
        stageHistory: { create: { toStage: stage, fromStage: null } },
      },
    });
    revalidateVoyages(voyage.id);
    return { ok: true, data: { id: voyage.id } };
  } catch {
    return { ok: false, error: "Couldn't chart that voyage. Try again." };
  }
}

export async function updateVoyage(
  id: string,
  input: VoyageInput,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: "Missing voyage id." };
  const parsed = parseVoyage(input);
  if (!parsed.ok) return parsed;
  const { stage } = parsed.data;
  try {
    const existing = await prisma.voyage.findUnique({
      where: { id },
      select: { closedAt: true, stage: true },
    });
    if (!existing) return { ok: false, error: "That voyage has sailed." };
    const changedStage = existing.stage !== stage;
    const voyage = await prisma.voyage.update({
      where: { id },
      data: {
        ...parsed.data,
        ...stageDerived(stage, existing.closedAt),
        ...(changedStage
          ? {
              stageHistory: {
                create: {
                  toStage: stage,
                  fromStage: existing.stage as VoyageStage,
                },
              },
            }
          : {}),
      },
    });
    revalidateVoyages(voyage.id);
    return { ok: true, data: { id: voyage.id } };
  } catch {
    return { ok: false, error: "Couldn't update that voyage. Try again." };
  }
}

/**
 * Move a voyage to a new stage. This is the mutation the kanban board fires on
 * drag-and-drop (and keyboard move); it persists the stage, refreshes the
 * stage's static probability, and stamps/clears `closedAt` when crossing the
 * open/closed boundary.
 */
export async function updateVoyageStage(
  id: string,
  stage: VoyageStage,
): Promise<ActionResult<{ id: string; stage: VoyageStage }>> {
  if (!id) return { ok: false, error: "Missing voyage id." };
  if (!VOYAGE_STAGES.includes(stage)) {
    return { ok: false, error: "Unknown stage." };
  }
  try {
    const existing = await prisma.voyage.findUnique({
      where: { id },
      select: { closedAt: true, stage: true },
    });
    if (!existing) return { ok: false, error: "That voyage has sailed." };
    if (existing.stage === stage) {
      return { ok: true, data: { id, stage } };
    }
    const voyage = await prisma.voyage.update({
      where: { id },
      data: {
        stage,
        ...stageDerived(stage, existing.closedAt),
        stageHistory: {
          create: { toStage: stage, fromStage: existing.stage as VoyageStage },
        },
      },
    });
    revalidateVoyages(voyage.id);
    return {
      ok: true,
      data: { id: voyage.id, stage: voyage.stage as VoyageStage },
    };
  } catch {
    return { ok: false, error: "Couldn't move that voyage. Try again." };
  }
}

export async function deleteVoyage(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Missing voyage id." };
  try {
    await prisma.voyage.delete({ where: { id } });
    revalidateVoyages();
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't scuttle that voyage. Try again." };
  }
}
