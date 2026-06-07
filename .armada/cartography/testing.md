# Testing — how tests really work in ARMADA-CRM-1

### vitest, DB-free, colocated
- **heuristic:** Tests run with `npm test` (`vitest run`); `npm run test:watch` for watch mode.
  Config in `vitest.config.ts` (uses `@vitejs/plugin-react`). Tests are colocated as `*.test.ts`
  next to the unit under test (e.g. `src/lib/voyage.test.ts`) and are **DB-free** — test pure domain
  helpers, not Prisma queries, so no `DATABASE_URL` or migration is needed to get a green suite.
  Baseline green = 6 passing tests.
- **evidence:** `vitest.config.ts`; `src/lib/voyage.test.ts` (6 passing); PR #9 "Testing performed".
- **confidence:** High
- **source:** PR #9 · 2026-06-07
