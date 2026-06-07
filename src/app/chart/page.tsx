import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { prisma } from "@/lib/db";
import { type VoyageStage } from "@/lib/voyage";
import { type ChartVoyage } from "@/lib/chart";
import { FleetChart } from "./fleet-chart";

export const dynamic = "force-dynamic";

/**
 * A stable seed for the procedural coastline. Tied to repo identity so the
 * harbour is consistent run-to-run (à la spyglass) rather than reshuffling on
 * every render.
 */
const CHART_SEED = "armada-crm-1:fleet-chart";

interface ChartData {
  ready: boolean;
  voyages: ChartVoyage[];
}

async function loadChart(): Promise<ChartData> {
  try {
    const voyages = await prisma.voyage.findMany({
      orderBy: { value: "desc" },
      include: { port: true },
    });
    return {
      ready: true,
      voyages: voyages.map((v) => ({
        id: v.id,
        name: v.name,
        stage: v.stage as VoyageStage,
        value: v.value,
        expectedClose: v.expectedClose
          ? v.expectedClose.toISOString().slice(0, 10)
          : null,
        portName: v.port?.name ?? null,
      })),
    };
  } catch {
    return { ready: false, voyages: [] };
  }
}

export default async function ChartPage() {
  const { ready, voyages } = await loadChart();

  return (
    <div>
      <PageHeader
        title="The Chart"
        subtitle="The living fleet — every voyage in flight, sailing from open sea toward harbour."
      />
      {!ready ? (
        <Card>
          <EmptyState
            title="No chart data yet"
            description="Run npm run db:migrate then npm run db:seed to provision the fleet, or chart a voyage once the database is ready."
          />
        </Card>
      ) : (
        <FleetChart voyages={voyages} seed={CHART_SEED} />
      )}
    </div>
  );
}
