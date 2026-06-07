import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import type { SearchItem } from "@/lib/search";
import { STAGE_META, type VoyageStage } from "@/lib/voyage";

/**
 * Live search index for The Helm command palette.
 *
 * Returns every port, captain, and voyage flattened into the palette's
 * {@link SearchItem} shape. The client fetches this once when the palette opens
 * and filters it locally as the user types, so keystrokes don't hit the
 * database. The dataset is small (a single fleet); if it ever grows large this
 * becomes a query-param-driven server search instead.
 *
 * Detail routes (`/ports/[id]`, …) land in sibling issues. To degrade
 * gracefully today, hits link to the existing list page with a `?focus=<id>`
 * query param — always a real route now, and forward-compatible with a list
 * that highlights/opens the focused record once those pages are built.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [ports, captains, voyages] = await Promise.all([
      prisma.port.findMany({
        select: { id: true, name: true, industry: true, location: true },
        orderBy: { name: "asc" },
      }),
      prisma.captain.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          title: true,
          port: { select: { name: true } },
        },
        orderBy: { lastName: "asc" },
      }),
      prisma.voyage.findMany({
        select: {
          id: true,
          name: true,
          stage: true,
          port: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const items: SearchItem[] = [
      ...ports.map((p): SearchItem => {
        const facets = [p.industry, p.location].filter(Boolean).join(" · ");
        return {
          id: p.id,
          kind: "port",
          title: p.name,
          subtitle: facets || undefined,
          href: `/ports?focus=${p.id}`,
        };
      }),
      ...captains.map((c): SearchItem => {
        const name = `${c.firstName} ${c.lastName}`.trim();
        const facets = [c.title, c.port?.name].filter(Boolean).join(" · ");
        return {
          id: c.id,
          kind: "captain",
          title: name,
          subtitle: facets || undefined,
          keywords: c.email ?? undefined,
          // Captains live under Ports today; degrade there until a captains
          // surface lands.
          href: `/ports?captain=${c.id}`,
        };
      }),
      ...voyages.map((v): SearchItem => {
        const stageLabel = STAGE_META[v.stage as VoyageStage]?.label ?? v.stage;
        const facets = [stageLabel, v.port?.name].filter(Boolean).join(" · ");
        return {
          id: v.id,
          kind: "voyage",
          title: v.name,
          subtitle: facets || undefined,
          href: `/voyages?focus=${v.id}`,
        };
      }),
    ];

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[helm/search] failed to build search index", error);
    return NextResponse.json(
      { items: [], error: "search-unavailable" },
      { status: 500 },
    );
  }
}
