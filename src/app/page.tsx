import { Anchor, Building2, ScrollText, Users } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { formatValue, stageMeta, type VoyageStage } from "@/lib/voyage";

export const dynamic = "force-dynamic";

interface BridgeData {
  ports: number;
  captains: number;
  activities: number;
  openValue: number;
  recentVoyages: {
    id: string;
    name: string;
    stage: VoyageStage;
    value: number;
    portName: string | null;
  }[];
  ready: boolean;
}

async function loadBridge(): Promise<BridgeData> {
  try {
    const [ports, captains, activities, voyages] = await Promise.all([
      prisma.port.count(),
      prisma.captain.count(),
      prisma.activity.count(),
      prisma.voyage.findMany({
        orderBy: { updatedAt: "desc" },
        take: 8,
        include: { port: true },
      }),
    ]);

    const openValue = voyages
      .filter((v) => stageMeta(v.stage as VoyageStage).open)
      .reduce((sum, v) => sum + v.value, 0);

    return {
      ports,
      captains,
      activities,
      openValue,
      recentVoyages: voyages.map((v) => ({
        id: v.id,
        name: v.name,
        stage: v.stage as VoyageStage,
        value: v.value,
        portName: v.port?.name ?? null,
      })),
      ready: true,
    };
  } catch {
    return {
      ports: 0,
      captains: 0,
      activities: 0,
      openValue: 0,
      recentVoyages: [],
      ready: false,
    };
  }
}

const SIGNAL_BADGE: Record<
  ReturnType<typeof stageMeta>["accent"],
  "signal-blue" | "signal-yellow" | "signal-green" | "signal-red" | "secondary"
> = {
  blue: "signal-blue",
  yellow: "signal-yellow",
  green: "signal-green",
  red: "signal-red",
  white: "secondary",
};

export default async function BridgePage() {
  const data = await loadBridge();

  const stats = [
    { label: "Ports", value: data.ports, icon: Building2, hint: "Companies" },
    {
      label: "Captains",
      value: data.captains,
      icon: Users,
      hint: "Contacts",
    },
    {
      label: "Open pipeline",
      value: formatValue(data.openValue),
      icon: Anchor,
      hint: "Voyages in flight",
    },
    {
      label: "Log entries",
      value: data.activities,
      icon: ScrollText,
      hint: "Activities",
    },
  ];

  return (
    <div>
      <PageHeader
        title="The Bridge"
        subtitle="Command view of the fleet — ports, captains, and voyages at a glance."
      />

      {!data.ready ? (
        <Card className="mb-6 border-signal-yellow/50">
          <CardHeader>
            <CardTitle className="text-lg">No chart data yet</CardTitle>
            <CardDescription>
              Run <code className="font-mono">npm run db:migrate</code> then{" "}
              <code className="font-mono">npm run db:seed</code> to provision
              the demo fleet.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, hint }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
              <Icon className="h-4 w-4 text-brass" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-3xl font-bold">{value}</div>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-xl">Recent voyages</CardTitle>
          <CardDescription>The latest deals to change course.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentVoyages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No voyages charted yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voyage</TableHead>
                  <TableHead>Port</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentVoyages.map((v) => {
                  const meta = stageMeta(v.stage);
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {v.portName ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={SIGNAL_BADGE[meta.accent]}>
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatValue(v.value)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
