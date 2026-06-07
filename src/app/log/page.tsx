import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { prisma } from "@/lib/db";
import { toTimelineActivity } from "@/lib/activity";
import { ActivityTimeline } from "./activity-timeline";

export const dynamic = "force-dynamic";

async function loadLog() {
  try {
    const rows = await prisma.activity.findMany({
      orderBy: { occurredAt: "desc" },
      take: 100,
      include: {
        captain: { select: { firstName: true, lastName: true } },
      },
    });
    return { ready: true, activities: rows.map(toTimelineActivity) };
  } catch {
    return { ready: false, activities: [] };
  }
}

export default async function LogPage() {
  const { ready, activities } = await loadLog();

  return (
    <div>
      <PageHeader
        title="The Log"
        subtitle="A timeline of every activity across the fleet — newest first."
      />
      {!ready ? (
        <Card>
          <EmptyState
            title="No chart data yet"
            description="Run npm run db:migrate then npm run db:seed to provision the fleet, or log an activity from any detail page."
          />
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <ActivityTimeline activities={activities} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
