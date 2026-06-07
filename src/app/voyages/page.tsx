import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { prisma } from "@/lib/db";
import { captainName } from "@/lib/ports";
import { type VoyageStage } from "@/lib/voyage";
import { VoyageBoard, type BoardVoyage } from "./voyage-board";
import { type VoyageOption } from "./voyage-dialog";

export const dynamic = "force-dynamic";

interface BoardData {
  ready: boolean;
  voyages: BoardVoyage[];
  ports: VoyageOption[];
  captains: VoyageOption[];
}

function isoDay(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

async function loadBoard(): Promise<BoardData> {
  try {
    const [voyages, ports, captains] = await Promise.all([
      prisma.voyage.findMany({
        orderBy: { updatedAt: "desc" },
        include: { port: true, captain: true },
      }),
      prisma.port.findMany({ orderBy: { name: "asc" } }),
      prisma.captain.findMany({ orderBy: { lastName: "asc" } }),
    ]);
    return {
      ready: true,
      voyages: voyages.map((v) => ({
        id: v.id,
        name: v.name,
        stage: v.stage as VoyageStage,
        value: v.value,
        expectedClose: isoDay(v.expectedClose),
        portId: v.portId,
        portName: v.port?.name ?? null,
        captainId: v.captainId,
        captainName: v.captain ? captainName(v.captain) : null,
        notes: v.notes,
      })),
      ports: ports.map((p) => ({ id: p.id, name: p.name })),
      captains: captains.map((c) => ({ id: c.id, name: captainName(c) })),
    };
  } catch {
    return { ready: false, voyages: [], ports: [], captains: [] };
  }
}

export default async function VoyagesPage() {
  const { ready, voyages, ports, captains } = await loadBoard();

  return (
    <div>
      <PageHeader
        title="The Passage"
        subtitle="Your deals in flight, charted from Charted to Anchored."
      />
      {!ready ? (
        <Card>
          <EmptyState
            title="No chart data yet"
            description="Run npm run db:migrate then npm run db:seed to provision the fleet, or chart a voyage once the database is ready."
          />
        </Card>
      ) : (
        <VoyageBoard voyages={voyages} ports={ports} captains={captains} />
      )}
    </div>
  );
}
