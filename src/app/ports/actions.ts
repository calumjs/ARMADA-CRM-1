"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import {
  captainSchema,
  portSchema,
  type CaptainInput,
  type PortInput,
} from "@/lib/ports";

/** The shape every mutation returns so the client can react uniformly. */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function parsePort(input: unknown) {
  const parsed = portSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  return { ok: true as const, data: parsed.data };
}

function parseCaptain(input: unknown) {
  const parsed = captainSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  return { ok: true as const, data: parsed.data };
}

function revalidatePorts(id?: string) {
  revalidatePath("/ports");
  revalidatePath("/captains");
  revalidatePath("/");
  if (id) revalidatePath(`/ports/${id}`);
}

// ── Ports ────────────────────────────────────────────────────────────────

export async function createPort(
  input: PortInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = parsePort(input);
  if (!parsed.ok) return parsed;
  try {
    const port = await prisma.port.create({ data: parsed.data });
    revalidatePorts(port.id);
    return { ok: true, data: { id: port.id } };
  } catch {
    return { ok: false, error: "Couldn't chart that port. Try again." };
  }
}

export async function updatePort(
  id: string,
  input: PortInput,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: "Missing port id." };
  const parsed = parsePort(input);
  if (!parsed.ok) return parsed;
  try {
    const port = await prisma.port.update({
      where: { id },
      data: parsed.data,
    });
    revalidatePorts(port.id);
    return { ok: true, data: { id: port.id } };
  } catch {
    return { ok: false, error: "Couldn't update that port. Try again." };
  }
}

export async function deletePort(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Missing port id." };
  try {
    await prisma.port.delete({ where: { id } });
    revalidatePorts();
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't scuttle that port. Try again." };
  }
}

// ── Captains ─────────────────────────────────────────────────────────────

export async function createCaptain(
  input: CaptainInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = parseCaptain(input);
  if (!parsed.ok) return parsed;
  try {
    const captain = await prisma.captain.create({ data: parsed.data });
    revalidatePorts(parsed.data.portId ?? undefined);
    revalidatePath("/captains");
    return { ok: true, data: { id: captain.id } };
  } catch (e) {
    return { ok: false, error: emailClash(e) };
  }
}

export async function updateCaptain(
  id: string,
  input: CaptainInput,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: "Missing captain id." };
  const parsed = parseCaptain(input);
  if (!parsed.ok) return parsed;
  try {
    const captain = await prisma.captain.update({
      where: { id },
      data: parsed.data,
    });
    revalidatePorts(parsed.data.portId ?? undefined);
    revalidatePath("/captains");
    return { ok: true, data: { id: captain.id } };
  } catch (e) {
    return { ok: false, error: emailClash(e) };
  }
}

export async function deleteCaptain(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Missing captain id." };
  try {
    await prisma.captain.delete({ where: { id } });
    revalidatePorts();
    revalidatePath("/captains");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't strike that captain. Try again." };
  }
}

/** Map a unique-constraint clash on `email` to a friendly message. */
function emailClash(e: unknown): string {
  const code = (e as { code?: string })?.code;
  if (code === "P2002") {
    return "Another captain already sails under that email.";
  }
  return "Couldn't save that captain. Try again.";
}
