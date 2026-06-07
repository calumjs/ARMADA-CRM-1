import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 reads the datasource and migration config from this file.
// The runtime data layer uses the better-sqlite3 driver adapter (see
// src/lib/db.ts) so no Rust query engine is needed — important on
// Windows-arm64, where Prisma ships no native query-engine binary.
const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: databaseUrl,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
