/**
 * Handler-level tests for the Navigator API route (`POST` / `GET`).
 *
 * These exercise the route handler itself — request parsing (zod), the error
 * paths, and the graceful no-AI-key degradation — without ever reaching a live
 * model. Following the action-test pattern, `@/lib/db` is backed by a fresh,
 * throwaway SQLite database built from the committed migration so the handler's
 * Prisma reads run end-to-end, and the server-side AI wrapper (`@/lib/ai`) is
 * mocked so no network/model call is ever made.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

import { applyMigrations } from "../test-db";

const tmpDir = mkdtempSync(path.join(tmpdir(), "armada-navigator-"));
const dbFile = path.join(tmpDir, "test.db");

const adapter = new PrismaBetterSqlite3({ url: `file:${dbFile}` });
const testPrisma = new PrismaClient({ adapter });

// Make the handler use our throwaway database.
vi.mock("@/lib/db", () => ({
  get prisma() {
    return testPrisma;
  },
}));

// Mock the server-side AI wrapper so no live model call is ever made. The
// individual tests drive `runNavigator` / `streamNavigator` per scenario.
const runNavigator = vi.fn();
const streamNavigator = vi.fn();
vi.mock("@/lib/ai", () => ({
  runNavigator: (...args: unknown[]) => runNavigator(...args),
  streamNavigator: (...args: unknown[]) => streamNavigator(...args),
}));

// Control whether a gateway key looks configured, independent of the real env.
let keyConfigured = false;
vi.mock("@/lib/navigator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/navigator")>();
  return {
    ...actual,
    hasGatewayKey: () => keyConfigured,
  };
});

// Imported after the mocks above are registered.
import { GET, POST } from "./route";

let voyageId = "";
let portId = "";

beforeAll(async () => {
  // Apply every committed migration in order so the throwaway DB matches the
  // generated Prisma client (later migrations add columns the includes touch).
  await applyMigrations(testPrisma);

  // Seed a minimal port + voyage so the handler has real context to load.
  const port = await testPrisma.port.create({
    data: { name: "Meridian Shipping Co.", industry: "Logistics" },
  });
  portId = port.id;
  const voyage = await testPrisma.voyage.create({
    data: {
      name: "Q3 Freight Renewal",
      stage: "UNDERWAY",
      value: 120000,
      portId: port.id,
    },
  });
  voyageId = voyage.id;
});

afterAll(async () => {
  await testPrisma.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  // Call history must not leak across cases (the mocks are file-scoped).
  runNavigator.mockReset();
  streamNavigator.mockReset();
});

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/navigator", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Unique IP per test keeps the in-memory rate limiter from bleeding
      // across cases.
      "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/navigator", () => {
  it("returns the expected { text } shape for a valid request", async () => {
    keyConfigured = true;
    runNavigator.mockResolvedValueOnce({ ok: true, text: "Send the proposal." });

    const res = await POST(
      postRequest({ task: "next-action", voyageId }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ text: "Send the proposal." });
    // The model layer was invoked through the wrapper, never directly.
    expect(runNavigator).toHaveBeenCalledTimes(1);
    expect(typeof runNavigator.mock.calls[0][0]).toBe("string");
  });

  it("returns HTTP 400 for an invalid body (no target, bad task)", async () => {
    // Missing both voyageId and portId → fails the zod refinement.
    const res1 = await POST(postRequest({ task: "next-action" }));
    expect(res1.status).toBe(400);
    expect((await res1.json()).error).toBeTruthy();

    // Unknown task → fails the enum.
    const res2 = await POST(
      postRequest({ task: "teleport", voyageId }),
    );
    expect(res2.status).toBe(400);

    // Not even JSON.
    const res3 = await POST(
      new Request("http://localhost/api/navigator", {
        method: "POST",
        headers: { "x-forwarded-for": "10.1.0.1" },
        body: "not json",
      }),
    );
    expect(res3.status).toBe(400);

    // No live model call on any invalid request.
    expect(runNavigator).not.toHaveBeenCalled();
    expect(streamNavigator).not.toHaveBeenCalled();
  });

  it("degrades gracefully (no 500) on the no-AI-key path, without a model call", async () => {
    keyConfigured = false;
    // The wrapper returns a typed no-key result rather than throwing — mirror
    // the real ai.ts contract.
    runNavigator.mockResolvedValueOnce({
      ok: false,
      error: "no key configured",
      code: "no-key",
    });

    const res = await POST(postRequest({ task: "summarise", voyageId }));

    // Graceful: 200, not 500.
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.code).toBe("no-key");
    expect(json.error).toBeTruthy();
  });

  it("answers the draft-follow-up no-key path with a 200 JSON message (no stream)", async () => {
    keyConfigured = false;
    // streamNavigator returns null when there's no key.
    streamNavigator.mockReturnValueOnce(null);

    const res = await POST(
      postRequest({ task: "draft-follow-up", voyageId }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.code).toBe("no-key");
    expect(json.error).toBeTruthy();
  });

  it("returns 404 when the referenced voyage does not exist", async () => {
    keyConfigured = true;
    const res = await POST(
      postRequest({ task: "next-action", voyageId: "does-not-exist" }),
    );
    expect(res.status).toBe(404);
    // Never reached the model.
    expect(runNavigator).not.toHaveBeenCalled();
  });

  it("summarises a port via the portId path", async () => {
    keyConfigured = true;
    runNavigator.mockResolvedValueOnce({
      ok: true,
      text: "Two voyages in flight; recent contact is strong.",
    });

    const res = await POST(postRequest({ task: "summarise", portId }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      text: "Two voyages in flight; recent contact is strong.",
    });
    expect(runNavigator).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/navigator", () => {
  it("reports configured=false when no key is present", async () => {
    keyConfigured = false;
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: false });
  });

  it("reports configured=true when a key is present", async () => {
    keyConfigured = true;
    const res = await GET();
    expect(await res.json()).toEqual({ configured: true });
  });
});
