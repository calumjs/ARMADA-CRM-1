/**
 * Handler-level tests for the Helm search index API route (`GET`).
 *
 * The route flattens every port, captain, and voyage into the palette's
 * `SearchItem` shape; ranking/limiting itself lives in the pure `@/lib/search`
 * helper (unit-tested separately) and runs client-side over this index. These
 * tests exercise the *handler*: the happy path returns well-formed items, the
 * empty-DB case is handled, the DB-failure path returns the designed graceful
 * error, and the returned index feeds the ranking helper as designed (a query
 * yields ranked, limited results).
 *
 * `@/lib/db` is backed by a fresh throwaway SQLite database built from the
 * committed migration — no network, no live model.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { searchItems, type SearchItem } from "@/lib/search";

import { applyMigrations } from "../test-db";

const tmpDir = mkdtempSync(path.join(tmpdir(), "armada-search-"));
const dbFile = path.join(tmpDir, "test.db");

const adapter = new PrismaBetterSqlite3({ url: `file:${dbFile}` });
const testPrisma = new PrismaClient({ adapter });

// Make the handler use our throwaway database.
vi.mock("@/lib/db", () => ({
  get prisma() {
    return testPrisma;
  },
}));

// Imported after the mock above is registered.
import { GET } from "./route";

beforeAll(async () => {
  await applyMigrations(testPrisma);
});

afterAll(async () => {
  await testPrisma.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("GET /api/search", () => {
  it("returns an empty index (not an error) when there is no data", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ items: [] });
  });

  it("flattens ports, captains, and voyages into the SearchItem shape", async () => {
    const port = await testPrisma.port.create({
      data: { name: "Meridian Shipping Co.", industry: "Logistics", location: "Bristol" },
    });
    await testPrisma.captain.create({
      data: {
        firstName: "Ada",
        lastName: "Vance",
        email: "ada.vance@example.com",
        title: "Procurement Lead",
        portId: port.id,
      },
    });
    await testPrisma.voyage.create({
      data: {
        name: "Q3 Freight Renewal",
        stage: "UNDERWAY",
        value: 120000,
        portId: port.id,
      },
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const { items } = (await res.json()) as { items: SearchItem[] };

    expect(items).toHaveLength(3);
    const kinds = items.map((i) => i.kind).sort();
    expect(kinds).toEqual(["captain", "port", "voyage"]);

    // Every item has the required SearchItem fields.
    for (const item of items) {
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(typeof item.href).toBe("string");
      expect(item.href.length).toBeGreaterThan(0);
    }

    const portItem = items.find((i) => i.kind === "port")!;
    expect(portItem.title).toBe("Meridian Shipping Co.");
    expect(portItem.subtitle).toContain("Logistics");
    expect(portItem.href).toBe(`/ports?focus=${port.id}`);

    const captainItem = items.find((i) => i.kind === "captain")!;
    expect(captainItem.title).toBe("Ada Vance");
    // Email folds into hidden keywords so the record is findable by it.
    expect(captainItem.keywords).toBe("ada.vance@example.com");
  });

  it("returns an index that the search helper ranks and limits as designed", async () => {
    const res = await GET();
    const { items } = (await res.json()) as { items: SearchItem[] };

    // A query yields ranked results from the (separately tested) helper.
    const ranked = searchItems("meridian", items);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].title).toBe("Meridian Shipping Co.");

    // Findable by a hidden-keyword facet (the captain's email).
    const byEmail = searchItems("ada.vance", items);
    expect(byEmail.some((i) => i.kind === "captain")).toBe(true);

    // Results are limited as designed.
    const limited = searchItems("", items, { limit: 2 });
    expect(limited).toHaveLength(2);

    // An empty query handled: preserves the index (default list) rather than
    // dropping everything.
    const all = searchItems("", items);
    expect(all).toHaveLength(items.length);

    // A non-matching query yields no hits.
    expect(searchItems("zzzznomatch", items)).toHaveLength(0);
  });

  it("returns a graceful 500 error payload when the DB read fails", async () => {
    // Force the underlying client to throw to exercise the catch path.
    const spy = vi
      .spyOn(testPrisma.port, "findMany")
      .mockRejectedValueOnce(new Error("db is down"));

    const res = await GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.items).toEqual([]);
    expect(json.error).toBe("search-unavailable");

    spy.mockRestore();
  });
});
