/**
 * Integration test for the Ports/Captains server actions. We mock `next/cache`
 * (revalidatePath only works inside a request) and back `@/lib/db` with a fresh,
 * throwaway SQLite database built from the committed migration, so the actions
 * run against a real Prisma client end-to-end.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// next/cache's revalidatePath throws outside a request — make it a no-op.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const tmpDir = mkdtempSync(path.join(tmpdir(), "armada-actions-"));
const dbFile = path.join(tmpDir, "test.db");

const adapter = new PrismaBetterSqlite3({ url: `file:${dbFile}` });
const testPrisma = new PrismaClient({ adapter });

// Make the actions use our throwaway database.
vi.mock("@/lib/db", () => ({
  get prisma() {
    return testPrisma;
  },
}));

// Imported after the mocks above are registered.
import {
  createCaptain,
  createPort,
  deletePort,
  updateCaptain,
  updatePort,
} from "./actions";

beforeAll(async () => {
  // Apply the committed init migration to the fresh database.
  const migrationSql = readFileSync(
    path.join(
      process.cwd(),
      "prisma",
      "migrations",
      "20260607023104_init",
      "migration.sql",
    ),
    "utf8",
  );
  for (const statement of migrationSql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)) {
    await testPrisma.$executeRawUnsafe(statement);
  }
});

afterAll(async () => {
  await testPrisma.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("createPort", () => {
  it("creates a port and persists it via Prisma", async () => {
    const result = await createPort({
      name: "Meridian Shipping Co.",
      industry: "Logistics",
      website: null,
      location: "Bristol",
      notes: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await testPrisma.port.findUnique({
      where: { id: result.data!.id },
    });
    expect(row?.name).toBe("Meridian Shipping Co.");
    expect(row?.industry).toBe("Logistics");
    expect(row?.location).toBe("Bristol");
  });

  it("rejects an invalid port and returns field errors", async () => {
    const result = await createPort({
      // @ts-expect-error — deliberately invalid to exercise validation
      name: "",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.name?.length).toBeGreaterThan(0);
  });
});

describe("updatePort", () => {
  it("updates an existing port's fields", async () => {
    const created = await createPort({
      name: "Halcyon Freight",
      industry: "Logistics",
      website: null,
      location: null,
      notes: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = created.data!.id;

    const updated = await updatePort(id, {
      name: "Halcyon Freight Ltd.",
      industry: "Shipping",
      website: "https://halcyon.example.com",
      location: "Rotterdam",
      notes: "Key account.",
    });
    expect(updated.ok).toBe(true);

    const row = await testPrisma.port.findUnique({ where: { id } });
    expect(row?.name).toBe("Halcyon Freight Ltd.");
    expect(row?.industry).toBe("Shipping");
    expect(row?.location).toBe("Rotterdam");
  });
});

describe("createCaptain / updateCaptain", () => {
  it("creates a captain linked to a port and can reassign them", async () => {
    const portA = await createPort({
      name: "Saltworks Trading",
      industry: null,
      website: null,
      location: null,
      notes: null,
    });
    const portB = await createPort({
      name: "Northwind Marine",
      industry: null,
      website: null,
      location: null,
      notes: null,
    });
    expect(portA.ok && portB.ok).toBe(true);
    if (!portA.ok || !portB.ok) return;

    const created = await createCaptain({
      firstName: "Ada",
      lastName: "Vance",
      email: "ada.vance@example.com",
      phone: null,
      title: "Procurement Lead",
      notes: null,
      portId: portA.data!.id,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    let row = await testPrisma.captain.findUnique({
      where: { id: created.data!.id },
    });
    expect(row?.firstName).toBe("Ada");
    expect(row?.portId).toBe(portA.data!.id);

    const updated = await updateCaptain(created.data!.id, {
      firstName: "Ada",
      lastName: "Vance",
      email: "ada.vance@example.com",
      phone: "+44 7700 900000",
      title: "Operations Director",
      notes: null,
      portId: portB.data!.id,
    });
    expect(updated.ok).toBe(true);

    row = await testPrisma.captain.findUnique({
      where: { id: created.data!.id },
    });
    expect(row?.title).toBe("Operations Director");
    expect(row?.portId).toBe(portB.data!.id);
  });

  it("surfaces a friendly error on a duplicate captain email", async () => {
    await createCaptain({
      firstName: "Rourke",
      lastName: "Okafor",
      email: "dup@example.com",
      phone: null,
      title: null,
      notes: null,
      portId: null,
    });
    const second = await createCaptain({
      firstName: "Mira",
      lastName: "Lindqvist",
      email: "dup@example.com",
      phone: null,
      title: null,
      notes: null,
      portId: null,
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toMatch(/email/i);
  });
});

describe("deletePort", () => {
  it("deletes a port and detaches its captains (SetNull)", async () => {
    const port = await createPort({
      name: "Coral Bay Holdings",
      industry: null,
      website: null,
      location: null,
      notes: null,
    });
    expect(port.ok).toBe(true);
    if (!port.ok) return;

    const captain = await createCaptain({
      firstName: "Elif",
      lastName: "Demir",
      email: "elif.demir@example.com",
      phone: null,
      title: null,
      notes: null,
      portId: port.data!.id,
    });
    expect(captain.ok).toBe(true);
    if (!captain.ok) return;

    const del = await deletePort(port.data!.id);
    expect(del.ok).toBe(true);

    const goneport = await testPrisma.port.findUnique({
      where: { id: port.data!.id },
    });
    expect(goneport).toBeNull();

    const orphan = await testPrisma.captain.findUnique({
      where: { id: captain.data!.id },
    });
    expect(orphan?.portId).toBeNull();
  });
});
