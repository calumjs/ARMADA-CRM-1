# Workflows — repo-specific procedures and ordering

The order operations must run in, codegen steps, and DB setup. Plan these as steps.

### Run `prisma generate` before building or type-checking
- **heuristic:** The Prisma client is generated to `src/generated/prisma` (gitignored), so it is
  absent on a fresh checkout. Run `prisma generate` first — `npm install` does it via `postinstall`,
  and `npm run build` runs `prisma generate && next build`. After a schema change, regenerate before
  relying on the client types or the `@/generated/prisma/client` import.
- **evidence:** `package.json`: `"build": "prisma generate && next build"`, `"postinstall": "prisma generate"`.
  PR #9 build verification confirmed the import resolves only after generate.
- **confidence:** High
- **source:** PR #9 · 2026-06-07

### Prisma 7 reads datasource + migration config from `prisma.config.ts`, not the schema
- **heuristic:** Configure the datasource `url` and the seed command in **`prisma.config.ts`**
  (Prisma 7 requirement), not in `schema.prisma`. The schema's `datasource db` block only declares
  `provider = "sqlite"`; the URL comes from `prisma.config.ts` (`process.env.DATABASE_URL ??
  "file:./prisma/dev.db"`), and `migrations.seed` points at `tsx prisma/seed.ts`.
- **evidence:** `prisma.config.ts` (`defineConfig({ schema, datasource: { url }, migrations: { seed } })`);
  `schema.prisma` `datasource db { provider = "sqlite" }` with no inline `url`.
- **confidence:** High
- **source:** PR #9 · 2026-06-07

### DB bring-up: migrate then seed
- **heuristic:** To get a working local DB: `npm run db:migrate` (`prisma migrate dev` — creates
  `prisma/dev.db`, applies the `init` migration) then `npm run db:seed` (`tsx prisma/seed.ts`).
  Seed yields 8 ports, 20 captains, 15 voyages across every stage, 45 activities. `prisma/dev.db` is
  gitignored; migrations and `package-lock.json` are committed.
- **evidence:** PR #9 "Testing performed"; `package.json` scripts; `.gitignore`.
- **confidence:** High
- **source:** PR #9 · 2026-06-07

### Standard validation commands
- **heuristic:** Validate a change with `npm run lint` (next lint), `npm test` (`vitest run`), and
  `npm run build` (`prisma generate && next build`). All three were green on the keel; the build
  produces 8 routes (Bridge dynamic, rest static).
- **evidence:** PR #9 "Testing performed" + muster verification.
- **confidence:** High
- **source:** PR #9 · 2026-06-07
