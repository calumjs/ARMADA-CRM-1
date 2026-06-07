/**
 * Integration test for the Log server actions. Mirrors ports/actions.test.ts:
 * mock next/cache, back @/lib/db with a throwaway SQLite database built from the
 * committed migrations, and run the actions against a real Prisma client.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const tmpDir = mkdtempSync(path.join(tmpdir(), "armada-log-"));
const dbFile = path.join(tmpDir, "test.db");

const adapter = new PrismaBetterSqlite3({ url: `file:${dbFile}` });
const testPrisma = new PrismaClient({ adapter });

vi.mock("@/lib/db", () => ({
  get prisma() {
    return testPrisma;
  },
}));

// Imported after the mocks above are registered.
import { createActivity, setTaskDone, deleteActivity } from "./actions";

/** Apply a committed migration's SQL to the throwaway database. */
async function applyMigration(name: string) {
  const sql = readFileSync(
    path.join(process.cwd(), "prisma", "migrations", name, "migration.sql"),
    "utf8",
  );
  for (const statement of sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)) {
    await testPrisma.$executeRawUnsafe(statement);
  }
}

beforeAll(async () => {
  await applyMigration("20260607023104_init");
  await applyMigration("20260607035225_activity_tasks");
});

afterAll(async () => {
  await testPrisma.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("createActivity", () => {
  it("logs a note against a port and persists it", async () => {
    const port = await testPrisma.port.create({
      data: { name: "Meridian Shipping Co." },
    });

    const result = await createActivity({
      type: "NOTE",
      subject: "Intro call with the captain",
      body: "Went well — sending a proposal.",
      dueAt: null,
      portId: port.id,
      captainId: null,
      voyageId: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await testPrisma.activity.findUnique({
      where: { id: result.data!.id },
    });
    expect(row?.subject).toBe("Intro call with the captain");
    expect(row?.type).toBe("NOTE");
    expect(row?.portId).toBe(port.id);
    // Non-task activities are complete the moment they're logged.
    expect(row?.done).toBe(true);
    expect(row?.completedAt).not.toBeNull();
    expect(row?.dueAt).toBeNull();
  });

  it("logs a task with a due date as open work", async () => {
    const voyage = await testPrisma.voyage.create({
      data: { name: "Spice Route Renewal" },
    });

    const result = await createActivity({
      type: "TASK",
      subject: "Send revised pricing",
      body: null,
      dueAt: "2026-07-01",
      portId: null,
      captainId: null,
      voyageId: voyage.id,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await testPrisma.activity.findUnique({
      where: { id: result.data!.id },
    });
    expect(row?.type).toBe("TASK");
    expect(row?.done).toBe(false);
    expect(row?.completedAt).toBeNull();
    expect(row?.dueAt?.toISOString().slice(0, 10)).toBe("2026-07-01");
  });

  it("rejects an activity with no target", async () => {
    const result = await createActivity({
      type: "NOTE",
      subject: "Orphan note",
      body: null,
      dueAt: null,
      portId: null,
      captainId: null,
      voyageId: null,
    });
    expect(result.ok).toBe(false);
  });
});

describe("setTaskDone", () => {
  it("marks a task complete and can reopen it", async () => {
    const created = await createActivity({
      type: "TASK",
      subject: "Chase the contract",
      body: null,
      dueAt: "2026-06-20",
      portId: null,
      captainId: null,
      voyageId: (
        await testPrisma.voyage.create({ data: { name: "Cold Chain" } })
      ).id,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = created.data!.id;

    const done = await setTaskDone(id, true);
    expect(done.ok).toBe(true);
    let row = await testPrisma.activity.findUnique({ where: { id } });
    expect(row?.done).toBe(true);
    expect(row?.completedAt).not.toBeNull();

    const reopened = await setTaskDone(id, false);
    expect(reopened.ok).toBe(true);
    row = await testPrisma.activity.findUnique({ where: { id } });
    expect(row?.done).toBe(false);
    expect(row?.completedAt).toBeNull();
  });
});

describe("deleteActivity", () => {
  it("removes a logged entry", async () => {
    const created = await createActivity({
      type: "NOTE",
      subject: "Disposable note",
      body: null,
      dueAt: null,
      portId: (await testPrisma.port.create({ data: { name: "Saltworks" } }))
        .id,
      captainId: null,
      voyageId: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const del = await deleteActivity(created.data!.id);
    expect(del.ok).toBe(true);

    const gone = await testPrisma.activity.findUnique({
      where: { id: created.data!.id },
    });
    expect(gone).toBeNull();
  });
});
