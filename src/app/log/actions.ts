"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { activitySchema, type ActivityInput } from "@/lib/activity";
import type { ActionResult } from "@/app/ports/actions";

/**
 * Revalidate every surface an activity can appear on. We don't always know which
 * detail page a change touches, so refresh the lot — cheap on a CRM this size.
 */
function revalidateLog(target?: {
  portId?: string | null;
  captainId?: string | null;
  voyageId?: string | null;
}) {
  revalidatePath("/log");
  revalidatePath("/orders");
  revalidatePath("/captains");
  revalidatePath("/");
  if (target?.portId) revalidatePath(`/ports/${target.portId}`);
  if (target?.voyageId) revalidatePath(`/voyages/${target.voyageId}`);
}

/**
 * Log an Activity against a port, captain, or voyage. A TASK with a due date is
 * persisted with `dueAt`; everything else is inherently complete.
 */
export async function createActivity(
  input: ActivityInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;
  const isTask = data.type === "TASK";

  try {
    const activity = await prisma.activity.create({
      data: {
        type: data.type,
        subject: data.subject,
        body: data.body,
        // Tasks live in the future (due date); other entries happened now.
        occurredAt: isTask && data.dueAt ? new Date(data.dueAt) : new Date(),
        dueAt: isTask && data.dueAt ? new Date(data.dueAt) : null,
        // Notes/calls/emails/meetings are complete the moment they're logged.
        done: !isTask,
        completedAt: isTask ? null : new Date(),
        portId: data.portId ?? null,
        captainId: data.captainId ?? null,
        voyageId: data.voyageId ?? null,
      },
    });
    revalidateLog(data);
    return { ok: true, data: { id: activity.id } };
  } catch {
    return { ok: false, error: "Couldn't log that activity. Try again." };
  }
}

/**
 * Mark a task complete (or reopen it). Sets `done` and stamps/clears
 * `completedAt`. Returns the target ids so the caller can revalidate.
 */
export async function setTaskDone(
  id: string,
  done: boolean,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: "Missing task id." };
  try {
    const task = await prisma.activity.update({
      where: { id },
      data: { done, completedAt: done ? new Date() : null },
      select: { id: true, portId: true, captainId: true, voyageId: true },
    });
    revalidateLog(task);
    return { ok: true, data: { id: task.id } };
  } catch {
    return { ok: false, error: "Couldn't update that task. Try again." };
  }
}

/** Delete a logged activity. */
export async function deleteActivity(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Missing activity id." };
  try {
    const removed = await prisma.activity.delete({
      where: { id },
      select: { id: true, portId: true, captainId: true, voyageId: true },
    });
    revalidateLog(removed);
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't remove that entry. Try again." };
  }
}
