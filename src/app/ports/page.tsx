import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { prisma } from "@/lib/db";
import { countOpenVoyages } from "@/lib/ports";
import { PortsTable, type PortRow } from "./ports-table";

export const dynamic = "force-dynamic";

async function loadPorts(): Promise<{ ports: PortRow[]; ready: boolean }> {
  try {
    const ports = await prisma.port.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { captains: true } },
        voyages: { select: { stage: true } },
      },
    });
    return {
      ready: true,
      ports: ports.map((p) => ({
        id: p.id,
        name: p.name,
        industry: p.industry,
        website: p.website,
        location: p.location,
        notes: p.notes,
        captainCount: p._count.captains,
        openVoyageCount: countOpenVoyages(p.voyages),
      })),
    };
  } catch {
    return { ready: false, ports: [] };
  }
}

export default async function PortsPage() {
  const { ports, ready } = await loadPorts();

  return (
    <div>
      <PageHeader
        title="Ports"
        subtitle="The companies your fleet trades with."
      />
      {!ready ? (
        <Card>
          <EmptyState
            title="No chart data yet"
            description="Run npm run db:migrate then npm run db:seed to provision the fleet, or chart a port once the database is ready."
          />
        </Card>
      ) : (
        <PortsTable ports={ports} />
      )}
    </div>
  );
}
