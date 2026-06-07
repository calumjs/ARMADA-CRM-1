# Architecture — how ARMADA-CRM-1 is put together

Where things live and what the stack is. Orient here before planning a change.

### Stack and layout
- **heuristic:** ARMADA CRM is a **Next.js 15 (App Router) + TypeScript** app at the repo root.
  Data layer: **Prisma 7 + SQLite via the `better-sqlite3` driver adapter** (no Rust engine; see
  pitfalls). UI: **Tailwind CSS 3 + hand-authored shadcn/ui** (Radix primitives). Tests: **vitest**.
  React 19. Key locations:
  - `src/app/` — App Router pages (Bridge = `page.tsx`, plus `ports/`, `voyages/`, `chart/`, `log/`,
    `styleguide/`).
  - `src/components/` — app shell (`app-shell.tsx`, `helm-nav.tsx`, `wordmark.tsx`, theme bits) and
    `ui/` shadcn primitives.
  - `src/lib/` — `db.ts` (Prisma singleton + adapter), `utils.ts` (cn), `voyage.ts` (domain logic).
  - `src/generated/prisma/` — generated Prisma client (gitignored).
  - `prisma/` — `schema.prisma`, `migrations/`, `seed.ts`; `prisma.config.ts` at root.
- **evidence:** PR #9 diff (file tree) + `package.json` dependencies.
- **confidence:** High
- **source:** PR #9 · 2026-06-07

### Data model
- **heuristic:** Core models in `prisma/schema.prisma`: **`Port`** (company), **`Captain`**
  (contact), **`Voyage`** (deal), **`Activity`** (log/task), with relations. Enums: **`VoyageStage`**
  (CHARTED, PROVISIONED, UNDERWAY, BOARDING, ANCHORED, WRECKED) and **`ActivityType`** (NOTE, CALL,
  EMAIL, MEETING, TASK). SQLite enum support required Prisma 6+, which drove the version choice.
  The model is meant to stay open for extension by sibling issues (add fields via migrations).
- **evidence:** `prisma/schema.prisma`; issue #1 acceptance criteria; PR #9 "Key decisions".
- **confidence:** High
- **source:** PR #9 · issue #1 · 2026-06-07
