import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { prisma } from "@/lib/db";
import { captainName } from "@/lib/ports";
import { OrdersBoard, type OrderTask } from "./orders-board";

export const dynamic = "force-dynamic";

async function loadOpenTasks(): Promise<{
  tasks: OrderTask[];
  ready: boolean;
}> {
  try {
    const rows = await prisma.activity.findMany({
      where: { type: "TASK", done: false },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      include: {
        captain: { select: { firstName: true, lastName: true } },
        port: { select: { id: true, name: true } },
        voyage: { select: { id: true, name: true } },
      },
    });
    return {
      ready: true,
      tasks: rows.map((t) => ({
        id: t.id,
        subject: t.subject,
        body: t.body,
        done: t.done,
        dueAt: t.dueAt ? t.dueAt.toISOString() : null,
        createdAt: t.createdAt.toISOString(),
        author: t.captain ? captainName(t.captain) : null,
        port: t.port ? { id: t.port.id, name: t.port.name } : null,
        voyage: t.voyage ? { id: t.voyage.id, name: t.voyage.name } : null,
      })),
    };
  } catch {
    return { ready: false, tasks: [] };
  }
}

export default async function OrdersPage() {
  const { tasks, ready } = await loadOpenTasks();

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Open tasks across the fleet — soonest due first, overdue flagged."
      />
      {!ready ? (
        <Card>
          <EmptyState
            title="No chart data yet"
            description="Run npm run db:migrate then npm run db:seed to provision the fleet, or log a task from any detail page."
          />
        </Card>
      ) : (
        <OrdersBoard tasks={tasks} />
      )}
    </div>
  );
}
