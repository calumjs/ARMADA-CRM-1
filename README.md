# ARMADA-CRM-1

A nautical, fleet-command CRM. Chart your **Ports** (companies), **Captains**
(contacts), and **Voyages** (deals) from **The Bridge**. Built on Next.js,
Prisma, Tailwind, and a bespoke ARMADA design system.

This project is commissioned to run on the
[ARMADA](https://github.com/calumjs/ARMADA) fleet — a set of Claude Code skills
that watch GitHub issues and drive them to merge-ready PRs.

## Stack

- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** components
- **Prisma** ORM with a **SQLite** datasource (swappable via `DATABASE_URL`)
- **Vitest** for unit tests
- ARMADA nautical design system with light/dark modes

> **Note on Prisma 7 + driver adapters.** The data layer uses the
> `better-sqlite3` driver adapter (`@prisma/adapter-better-sqlite3`) rather than
> the bundled Rust query engine. This keeps the app running on platforms where
> Prisma ships no native query-engine binary (e.g. Windows-arm64) and makes the
> datasource trivially swappable later.

## Vocabulary

| Term       | Means              |
| ---------- | ------------------ |
| Port       | Company / account  |
| Captain    | Contact            |
| Voyage     | Deal / opportunity |
| The Bridge | Dashboard          |
| The Chart  | Deal pipeline map  |
| The Helm   | Navigation rail    |
| The Log    | Activity timeline  |

A **Voyage** moves through stages: `CHARTED → PROVISIONED → UNDERWAY → BOARDING
→ ANCHORED` (won) or `WRECKED` (lost).

## Getting started

### Prerequisites

- Node.js 20+ (developed against Node 24)
- npm

### Setup

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Configure the database URL
cp .env.example .env        # DATABASE_URL="file:./prisma/dev.db"

# 3. Create the SQLite database and apply migrations
npm run db:migrate

# 4. Seed demo data (8 ports, 20 captains, 15 voyages, assorted activities)
npm run db:seed

# 5. Run the dev server
npm run dev                 # http://localhost:3000
```

Visit `/styleguide` to see the ARMADA design system — palette, type scale, and
core components in both light and dark mode.

### The Navigator (AI co-pilot) — optional

The **Navigator** is an optional AI co-pilot (deal-health "tides", next-best
actions, drafted follow-ups). It's entirely optional: **the app runs fully
without it**, showing a clear "no key" message wherever live AI would appear.

To enable live AI, set the Vercel AI Gateway key in your `.env`:

```bash
AI_GATEWAY_API_KEY="your-ai-gateway-key-here"
```

When deployed on Vercel the platform-injected `VERCEL_OIDC_TOKEN` works as an
alternative credential, so no key needs to be set by hand there. The model can
be overridden with `NAVIGATOR_MODEL` (a plain AI Gateway `provider/model`
string; defaults to `anthropic/claude-sonnet-4.5`). See `.env.example` for all
Navigator variables.

## Scripts

| Script               | Does                                                |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Start the Next.js dev server                        |
| `npm run build`      | Generate the Prisma client and build for production |
| `npm run start`      | Serve the production build                          |
| `npm run lint`       | Lint with ESLint (`next lint`)                      |
| `npm test`           | Run the Vitest suite                                |
| `npm run format`     | Format the codebase with Prettier                   |
| `npm run db:migrate` | Apply Prisma migrations (`prisma migrate dev`)      |
| `npm run db:seed`    | Seed the database with demo data                    |

## Project layout

```
prisma/
  schema.prisma     # Port, Captain, Voyage, Activity + VoyageStage enum
  seed.ts           # demo data
  migrations/       # generated SQL migrations
src/
  app/              # App Router pages (Bridge, Ports, Voyages, Chart, Log, Styleguide)
  components/       # app shell (The Helm), wordmark, theme toggle
  components/ui/    # shadcn/ui components
  lib/              # db client (Prisma + adapter), domain helpers, utils
  generated/prisma/ # generated Prisma client (gitignored)
```

## ARMADA

This repo is commissioned for ARMADA. Config lives in
[`.armada/config.json`](.armada/config.json).

- **Trigger label:** `armada` — label an issue with it to hand it to the fleet.
- **Base branch:** `main`

### Working an issue

```bash
# 1. File an issue (or use /charter to draft + arm one)
# 2. Arm it for the fleet
gh issue edit <number> --add-label armada
# 3. Man the lookout (run the crows-nest skill, or say "watch for issues")
```
