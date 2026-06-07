import Link from "next/link";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  Anchor,
  Building2,
  CheckCircle2,
  Circle,
  ClipboardList,
  Coins,
  ListChecks,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { captainName } from "@/lib/ports";
import {
  ACTIVITY_LABEL,
  formatWhen,
  type ActivityType,
} from "@/lib/activity";
import { formatPercent, formatValue, type VoyageStage } from "@/lib/voyage";
import {
  PERIOD_LABEL,
  bridgeMetrics,
  parsePeriod,
  pipelineByStage,
  voyagesNeedingAttention,
  voyagesWonOverTime,
  type AttentionFlag,
  type BridgeMetrics,
  type BridgePeriod,
  type StageBucket,
  type WonOverTimePoint,
} from "@/lib/bridge";
import { PeriodFilter } from "./period-filter";
import { PipelineByStageChart, VoyagesWonChart } from "./bridge-charts";

export const dynamic = "force-dynamic";

interface TaskRow {
  id: string;
  subject: string;
  occurredAt: Date;
  voyageName: string | null;
  overdue: boolean;
}

interface ActivityRow {
  id: string;
  type: ActivityType;
  subject: string;
  occurredAt: Date;
  voyageName: string | null;
  portName: string | null;
  captainLabel: string | null;
}

interface BridgeData {
  ready: boolean;
  activePorts: number;
  metrics: BridgeMetrics;
  pipeline: StageBucket[];
  wonSeries: WonOverTimePoint[];
  attention: AttentionFlag[];
  tasks: TaskRow[];
  recent: ActivityRow[];
}

async function loadBridge(period: BridgePeriod): Promise<BridgeData> {
  const now = new Date();
  try {
    const [voyages, activePorts, tasksDue, recentActivity] = await Promise.all([
      prisma.voyage.findMany({
        include: { port: { select: { name: true } } },
      }),
      // A port is "active" once it has at least one open voyage.
      prisma.port.count({
        where: {
          voyages: {
            some: { stage: { notIn: ["ANCHORED", "WRECKED"] } },
          },
        },
      }),
      prisma.activity.findMany({
        where: { type: "TASK", done: false },
        orderBy: { occurredAt: "asc" },
        take: 6,
        include: { voyage: { select: { name: true } } },
      }),
      prisma.activity.findMany({
        orderBy: { occurredAt: "desc" },
        take: 7,
        include: {
          voyage: { select: { name: true } },
          port: { select: { name: true } },
          captain: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const metricVoyages = voyages.map((v) => ({
      value: v.value,
      stage: v.stage as VoyageStage,
      closedAt: v.closedAt,
      expectedClose: v.expectedClose,
    }));

    const attention = voyagesNeedingAttention(
      voyages.map((v) => ({
        id: v.id,
        name: v.name,
        stage: v.stage as VoyageStage,
        value: v.value,
        expectedClose: v.expectedClose,
        updatedAt: v.updatedAt,
        portName: v.port?.name ?? null,
      })),
      now,
    );

    return {
      ready: true,
      activePorts,
      metrics: bridgeMetrics(metricVoyages, period, now),
      pipeline: pipelineByStage(
        voyages.map((v) => ({ value: v.value, stage: v.stage as VoyageStage })),
      ),
      wonSeries: voyagesWonOverTime(
        voyages.map((v) => ({
          value: v.value,
          stage: v.stage as VoyageStage,
          closedAt: v.closedAt,
        })),
        6,
        now,
      ),
      attention: attention.slice(0, 5),
      tasks: tasksDue.map((t) => ({
        id: t.id,
        subject: t.subject,
        occurredAt: t.occurredAt,
        voyageName: t.voyage?.name ?? null,
        overdue: t.occurredAt.getTime() < now.getTime(),
      })),
      recent: recentActivity.map((a) => ({
        id: a.id,
        type: a.type as ActivityType,
        subject: a.subject,
        occurredAt: a.occurredAt,
        voyageName: a.voyage?.name ?? null,
        portName: a.port?.name ?? null,
        captainLabel: a.captain ? captainName(a.captain) : null,
      })),
    };
  } catch {
    return {
      ready: false,
      activePorts: 0,
      metrics: {
        pipelineValue: 0,
        weightedForecast: 0,
        voyagesWon: 0,
        winRate: 0,
        wonValue: 0,
      },
      pipeline: [],
      wonSeries: [],
      attention: [],
      tasks: [],
      recent: [],
    };
  }
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}) {
  return (
    <Card>
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
  );
}

export default async function BridgePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period = parsePeriod(periodParam);
  const data = await loadBridge(period);
  const periodLabel = PERIOD_LABEL[period].toLowerCase();

  const kpis = [
    {
      label: "Total pipeline",
      value: formatValue(data.metrics.pipelineValue),
      hint: "Open voyage value",
      icon: Coins,
    },
    {
      label: "Weighted forecast",
      value: formatValue(data.metrics.weightedForecast),
      hint: "Value × win likelihood",
      icon: TrendingUp,
    },
    {
      label: "Voyages won",
      value: String(data.metrics.voyagesWon),
      hint: `${formatValue(data.metrics.wonValue)} ${periodLabel}`,
      icon: Anchor,
    },
    {
      label: "Win rate",
      value: formatPercent(data.metrics.winRate),
      hint: `Won vs lost ${periodLabel}`,
      icon: Target,
    },
    {
      label: "Active ports",
      value: String(data.activePorts),
      hint: "With an open voyage",
      icon: Building2,
    },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="The Bridge"
          subtitle="Command view of the fleet — pipeline health, KPIs, and what needs your hand on the wheel."
        />
        <div className="shrink-0 sm:pb-1">
          <PeriodFilter active={period} />
        </div>
      </div>

      {!data.ready ? (
        <Card className="mb-6 border-signal-yellow/50">
          <CardHeader>
            <CardTitle className="text-lg">No chart data yet</CardTitle>
            <CardDescription>
              Run <code className="font-mono">npm run db:migrate</code> then{" "}
              <code className="font-mono">npm run db:seed</code> to provision the
              demo fleet.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <Kpi key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Pipeline by stage</CardTitle>
            <CardDescription>
              Open voyage value charted across the stages.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.pipeline.some((b) => b.value > 0) ? (
              <PipelineByStageChart data={data.pipeline} />
            ) : (
              <EmptyState
                icon={Anchor}
                title="No open voyages"
                description="Chart a voyage to fill the pipeline."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Voyages won over time</CardTitle>
            <CardDescription>
              Anchored deals across the last six months.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.wonSeries.some((p) => p.won > 0) ? (
              <VoyagesWonChart data={data.wonSeries} />
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="No voyages won yet"
                description="Anchor a voyage and it will chart here."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attention list */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-5 w-5 text-signal-yellow" />
            Voyages needing attention
          </CardTitle>
          <CardDescription>
            Open voyages past their close date or gone quiet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.attention.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="All voyages on course"
              description="Nothing overdue or stalled — steady as she goes."
            />
          ) : (
            <ul className="divide-y divide-border">
              {data.attention.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/voyages/${v.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {v.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {v.portName ?? "Unassigned port"} ·{" "}
                      {formatValue(v.value)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {v.reason === "overdue"
                        ? `${v.days}d overdue`
                        : `${v.days}d quiet`}
                    </span>
                    <Badge
                      variant={
                        v.reason === "overdue" ? "signal-red" : "signal-yellow"
                      }
                    >
                      {v.reason === "overdue" ? "Overdue" : "Stalled"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Tasks due + recent activity */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ListChecks className="h-5 w-5 text-brass" />
              Tasks due
            </CardTitle>
            <CardDescription>Open tasks across the fleet.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.tasks.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No tasks due"
                description="The deck is clear."
              />
            ) : (
              <ul className="space-y-3">
                {data.tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-3">
                    <Circle
                      className={
                        t.overdue
                          ? "mt-0.5 h-4 w-4 shrink-0 text-signal-red"
                          : "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {t.subject}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.voyageName ? `${t.voyageName} · ` : ""}
                        <span className={t.overdue ? "text-signal-red" : ""}>
                          {formatWhen(t.occurredAt)}
                        </span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ActivityIcon className="h-5 w-5 text-brass" />
              Recent activity
            </CardTitle>
            <CardDescription>The latest entries in the log.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recent.length === 0 ? (
              <EmptyState
                icon={ActivityIcon}
                title="No activity logged"
                description="Log a call, note, or meeting to see it here."
              />
            ) : (
              <ul className="space-y-3">
                {data.recent.map((a) => {
                  const context =
                    a.voyageName ?? a.portName ?? a.captainLabel ?? null;
                  return (
                    <li key={a.id} className="flex items-start gap-3">
                      <Badge variant="secondary" className="mt-0.5 shrink-0">
                        {ACTIVITY_LABEL[a.type]}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {a.subject}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {context ? `${context} · ` : ""}
                          {formatWhen(a.occurredAt)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
