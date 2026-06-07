/**
 * Integration test for the Voyage server actions — focused on the stage-update
 * mutation the kanban board fires on drag-and-drop. We mock `next/cache`
 * (revalidatePath only works inside a request) and back `@/lib/db` with a fresh,
 * throwaway SQLite database built from the committed migrations, so the actions
 * run against a real Prisma client end-to-end.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const tmpDir = mkdtempSync(path.join(tmpdir(), "armada-voyages-"));
const dbFile = path.join(tmpDir, "test.db");

const adapter = new PrismaBetterSqlite3({ url: `file:${dbFile}` });
const testPrisma = new PrismaClient({ adapter });

vi.mock("@/lib/db", () => ({
  get prisma() {
    return testPrisma;
  },
}));

// Imported after the mocks above are registered.
import {
  createVoyage,
  deleteVoyage,
  updateVoyage,
  updateVoyageStage,
} from "./actions";
import { stageProbability } from "@/lib/voyage";

beforeAll(async () => {
  // Apply every committed migration, in lexical (timestamped) order, to the
  // fresh database — so the schema (incl. VoyageStageEvent) is fully built.
  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
  const dirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  for (const dir of dirs) {
    const sql = readFileSync(
      path.join(migrationsDir, dir, "migration.sql"),
      "utf8",
    );
    for (const statement of sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)) {
      await testPrisma.$executeRawUnsafe(statement);
    }
  }
});

afterAll(async () => {
  await testPrisma.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

async function newVoyage(name = "Q3 freight contract") {
  const created = await createVoyage({
    name,
    stage: "CHARTED",
    value: 100000,
    expectedClose: null,
    portId: null,
    captainId: null,
    notes: null,
  });
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error("setup failed");
  return created.data!.id;
}

describe("updateVoyageStage", () => {
  it("persists the new stage and refreshes the stage probability", async () => {
    const id = await newVoyage();

    const moved = await updateVoyageStage(id, "UNDERWAY");
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.data!.stage).toBe("UNDERWAY");

    const row = await testPrisma.voyage.findUnique({ where: { id } });
    expect(row?.stage).toBe("UNDERWAY");
    expect(row?.probability).toBe(stageProbability("UNDERWAY"));
    expect(row?.closedAt).toBeNull();
  });

  it("stamps closedAt when moving into a closed stage and clears it on reopen", async () => {
    const id = await newVoyage("Won deal");

    const won = await updateVoyageStage(id, "ANCHORED");
    expect(won.ok).toBe(true);
    let row = await testPrisma.voyage.findUnique({ where: { id } });
    expect(row?.stage).toBe("ANCHORED");
    expect(row?.closedAt).toBeInstanceOf(Date);
    expect(row?.probability).toBe(100);

    const reopened = await updateVoyageStage(id, "BOARDING");
    expect(reopened.ok).toBe(true);
    row = await testPrisma.voyage.findUnique({ where: { id } });
    expect(row?.stage).toBe("BOARDING");
    expect(row?.closedAt).toBeNull();
  });

  it("records a stage-history event for each move (with from/to)", async () => {
    const id = await newVoyage("History deal");

    await updateVoyageStage(id, "PROVISIONED");
    await updateVoyageStage(id, "UNDERWAY");

    const events = await testPrisma.voyageStageEvent.findMany({
      where: { voyageId: id },
      orderBy: { createdAt: "asc" },
    });
    // One on creation (CHARTED, no from) + two moves.
    expect(events.length).toBe(3);
    expect(events[0].fromStage).toBeNull();
    expect(events[0].toStage).toBe("CHARTED");
    expect(events[1].fromStage).toBe("CHARTED");
    expect(events[1].toStage).toBe("PROVISIONED");
    expect(events[2].fromStage).toBe("PROVISIONED");
    expect(events[2].toStage).toBe("UNDERWAY");
  });

  it("is a no-op when the stage is unchanged", async () => {
    const id = await newVoyage("Same stage");
    const before = await testPrisma.voyageStageEvent.count({
      where: { voyageId: id },
    });

    const result = await updateVoyageStage(id, "CHARTED");
    expect(result.ok).toBe(true);

    const after = await testPrisma.voyageStageEvent.count({
      where: { voyageId: id },
    });
    expect(after).toBe(before);
  });

  it("rejects an unknown stage", async () => {
    const id = await newVoyage("Bad stage");
    // @ts-expect-error — deliberately invalid to exercise the guard.
    const result = await updateVoyageStage(id, "MUTINY");
    expect(result.ok).toBe(false);
  });

  it("errors for a missing voyage", async () => {
    const result = await updateVoyageStage("does-not-exist", "UNDERWAY");
    expect(result.ok).toBe(false);
  });
});

describe("createVoyage / updateVoyage / deleteVoyage", () => {
  it("creates a voyage with a seeded stage-history entry", async () => {
    const id = await newVoyage("Fresh voyage");
    const row = await testPrisma.voyage.findUnique({
      where: { id },
      include: { stageHistory: true },
    });
    expect(row?.stageHistory.length).toBe(1);
    expect(row?.probability).toBe(stageProbability("CHARTED"));
  });

  it("records history on an edit that changes the stage", async () => {
    const id = await newVoyage("Editable voyage");
    const updated = await updateVoyage(id, {
      name: "Editable voyage",
      stage: "BOARDING",
      value: 250000,
      expectedClose: null,
      portId: null,
      captainId: null,
      notes: "Pushed forward.",
    });
    expect(updated.ok).toBe(true);

    const row = await testPrisma.voyage.findUnique({
      where: { id },
      include: { stageHistory: true },
    });
    expect(row?.stage).toBe("BOARDING");
    expect(row?.value).toBe(250000);
    // creation event + the stage-changing edit
    expect(row?.stageHistory.length).toBe(2);
  });

  it("rejects an invalid voyage and returns field errors", async () => {
    const result = await createVoyage({
      // @ts-expect-error — deliberately invalid to exercise validation
      name: "",
      stage: "CHARTED",
      value: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.name?.length).toBeGreaterThan(0);
  });

  it("deletes a voyage and cascades its stage history", async () => {
    const id = await newVoyage("Doomed voyage");
    await updateVoyageStage(id, "UNDERWAY");

    const del = await deleteVoyage(id);
    expect(del.ok).toBe(true);

    const gone = await testPrisma.voyage.findUnique({ where: { id } });
    expect(gone).toBeNull();
    const orphans = await testPrisma.voyageStageEvent.count({
      where: { voyageId: id },
    });
    expect(orphans).toBe(0);
  });
});
