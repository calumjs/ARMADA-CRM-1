/**
 * Test helper: apply every committed Prisma migration, in order, to a throwaway
 * SQLite database. Used by the API route handler tests so the database the
 * handlers read matches the generated Prisma client (later migrations add
 * columns — e.g. `Activity.dueAt` — that the route's `include`s select).
 *
 * Mirrors the single-migration approach in the server-action tests, but walks
 * the whole `prisma/migrations` directory so the schema is complete.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { PrismaClient } from "@/generated/prisma/client";

/** Minimal shape we need — just the raw-exec escape hatch. */
type RawExecutor = Pick<PrismaClient, "$executeRawUnsafe">;

export async function applyMigrations(prisma: RawExecutor): Promise<void> {
  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
  const dirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(); // timestamp-prefixed names sort chronologically

  for (const dir of dirs) {
    const sqlPath = path.join(migrationsDir, dir, "migration.sql");
    const sql = readFileSync(sqlPath, "utf8");
    for (const statement of sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)) {
      await prisma.$executeRawUnsafe(statement);
    }
  }
}
