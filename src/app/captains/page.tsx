import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { prisma } from "@/lib/db";
import { type VoyageStage } from "@/lib/voyage";
import { CaptainsTable, type CaptainRow } from "./captains-table";
import type { PortOption } from "./captain-dialog";

export const dynamic = "force-dynamic";

async function loadCaptains(): Promise<{
  captains: CaptainRow[];
  ports: PortOption[];
  ready: boolean;
}> {
  try {
    const [captains, ports] = await Promise.all([
      prisma.captain.findMany({
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        include: {
          port: { select: { id: true, name: true } },
          voyages: {
            orderBy: { updatedAt: "desc" },
            select: { id: true, name: true, stage: true, value: true },
          },
        },
      }),
      prisma.port.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    return {
      ready: true,
      ports,
      captains: captains.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        title: c.title,
        notes: c.notes,
        portId: c.portId,
        portName: c.port?.name ?? null,
        voyages: c.voyages.map((v) => ({
          id: v.id,
          name: v.name,
          stage: v.stage as VoyageStage,
          value: v.value,
        })),
      })),
    };
  } catch {
    return { ready: false, ports: [], captains: [] };
  }
}

export default async function CaptainsPage() {
  const { captains, ports, ready } = await loadCaptains();

  return (
    <div>
      <PageHeader
        title="Captains"
        subtitle="The people you deal with at each port."
      />
      {!ready ? (
        <Card>
          <EmptyState
            title="No chart data yet"
            description="Run npm run db:migrate then npm run db:seed to provision the fleet, or sign on a captain once the database is ready."
          />
        </Card>
      ) : (
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
          <CaptainsTable captains={captains} ports={ports} />
        </Suspense>
      )}
    </div>
  );
}
