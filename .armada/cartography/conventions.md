# Conventions — house style for ARMADA-CRM-1

Naming, structure, and the patterns the repo enforces. Shape implementations to match.

### Import the Prisma client from the shared `src/lib/db.ts` singleton
- **heuristic:** Use the exported `prisma` singleton from `src/lib/db.ts` for DB access — don't
  construct `PrismaClient` ad hoc. It wires the `better-sqlite3` driver adapter and caches the client
  on `globalThis` outside production (avoids dev hot-reload connection storms). Types/client come from
  `@/generated/prisma/client`.
- **evidence:** `src/lib/db.ts` exports `prisma` with the adapter + `globalForPrisma` singleton guard.
- **confidence:** High
- **source:** PR #9 · 2026-06-07

### Hand-author shadcn/ui components — do not fetch from the network registry
- **heuristic:** Add shadcn/ui components by hand-authoring them under `src/components/ui/` rather
  than running the registry fetch (`shadcn add`). The build is kept reproducible offline. Existing UI
  primitives: button, card, input, dialog, dropdown-menu, badge, avatar, table.
- **evidence:** PR #9 "Key decisions" — "Hand-authored shadcn/ui components (no network registry
  fetch) so the build is reproducible offline"; `src/components/ui/*.tsx` committed directly.
- **confidence:** High
- **source:** PR #9 · 2026-06-07

### Keep domain logic Prisma-free and unit-tested
- **heuristic:** Put pure domain/business helpers (e.g. voyage stage logic) in plain modules like
  `src/lib/voyage.ts` with no Prisma import, and unit-test them with vitest (`*.test.ts` colocated).
  This keeps the test suite DB-free and fast.
- **evidence:** `src/lib/voyage.ts` + `src/lib/voyage.test.ts` (6 passing tests); muster praised
  "domain helpers are Prisma-free and unit-tested".
- **confidence:** High
- **source:** PR #9 · 2026-06-07

### Degrade gracefully when no DB is present
- **heuristic:** Server components/pages that read seeded data should wrap DB reads in try/catch and
  fall back to a "run migrate + seed" prompt rather than erroring when the DB is absent (the Bridge
  does this).
- **evidence:** PR #9 notes + muster — "the Bridge degrades gracefully with no DB (try/catch → 'run
  migrate + seed')".
- **confidence:** Medium
- **source:** PR #9 · 2026-06-07
