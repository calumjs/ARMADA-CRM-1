import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Anchor,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  Coins,
  Gauge,
  ScrollText,
  UserRound,
} from "lucide-react";

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
import {
  ACTIVITY_LABEL,
  formatDate,
  formatWhen,
  type ActivityType,
} from "@/lib/activity";
import { captainName } from "@/lib/ports";
import {
  formatValue,
  stageMeta,
  stageProbability,
  voyageHealth,
  type VoyageStage,
} from "@/lib/voyage";
import {
  hasGatewayKey,
  nextBestAction,
  tidesScore,
  type VoyageSnapshot,
} from "@/lib/navigator";
import { NavigatorPanel } from "@/components/navigator-panel";
import { VoyageDetailActions } from "./voyage-detail-actions";

export const dynamic = "force-dynamic";

const SIGNAL_BADGE = {
  blue: "signal-blue",
  yellow: "signal-yellow",
  green: "signal-green",
  red: "signal-red",
  white: "secondary",
} as const;

async function loadVoyage(id: string) {
  try {
    return await prisma.voyage.findUnique({
      where: { id },
      include: {
        port: true,
        captain: true,
        activities: {
          orderBy: { occurredAt: "desc" },
          take: 12,
          include: { captain: true },
        },
        stageHistory: { orderBy: { createdAt: "desc" } },
      },
    });
  } catch {
    return null;
  }
}

async function loadOptions() {
  try {
    const [ports, captains] = await Promise.all([
      prisma.port.findMany({ orderBy: { name: "asc" } }),
      prisma.captain.findMany({ orderBy: { lastName: "asc" } }),
    ]);
    return {
      ports: ports.map((p) => ({ id: p.id, name: p.name })),
      captains: captains.map((c) => ({ id: c.id, name: captainName(c) })),
    };
  } catch {
    return { ports: [], captains: [] };
  }
}

export default async function VoyageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [voyage, options] = await Promise.all([loadVoyage(id), loadOptions()]);
  if (!voyage) notFound();

  const stage = voyage.stage as VoyageStage;
  const meta = stageMeta(stage);
  const health = voyageHealth({
    stage,
    expectedClose: voyage.expectedClose,
  });

  // Navigator (AI co-pilot) context — computed server-side, Prisma-free helpers.
  const navigatorVoyage: VoyageSnapshot = {
    name: voyage.name,
    stage,
    value: voyage.value,
    expectedClose: voyage.expectedClose,
    portName: voyage.port?.name ?? null,
    captainName: voyage.captain ? captainName(voyage.captain) : null,
    notes: voyage.notes,
    activities: voyage.activities.map((a) => ({
      type: a.type,
      subject: a.subject,
      occurredAt: a.occurredAt,
    })),
  };
  const tides = tidesScore(navigatorVoyage);
  const nextAction = nextBestAction(navigatorVoyage);

  return (
    <div className="space-y-6">
      <Link
        href="/voyages"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        The Passage
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-brass">
              <Anchor className="h-6 w-6" />
            </span>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight">
                {voyage.name}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant={SIGNAL_BADGE[meta.accent]}>{meta.label}</Badge>
                <Badge variant={SIGNAL_BADGE[health.accent]}>
                  {health.label}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <VoyageDetailActions
          voyage={{
            id: voyage.id,
            name: voyage.name,
            stage: voyage.stage,
            value: voyage.value,
            expectedClose: voyage.expectedClose
              ? voyage.expectedClose.toISOString().slice(0, 10)
              : null,
            portId: voyage.portId,
            captainId: voyage.captainId,
            notes: voyage.notes,
          }}
          ports={options.ports}
          captains={options.captains}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat icon={Coins} label="Value" value={formatValue(voyage.value)} />
        <Stat
          icon={Gauge}
          label="Stage odds"
          value={`${stageProbability(stage)}%`}
        />
        <Stat
          icon={CalendarClock}
          label="Expected close"
          value={voyage.expectedClose ? formatDate(voyage.expectedClose) : "—"}
        />
        <Stat
          icon={Anchor}
          label="Closed"
          value={voyage.closedAt ? formatDate(voyage.closedAt) : "Open"}
        />
      </div>

      {/* Linked port & captain */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-brass">
              <Building2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Port
              </p>
              {voyage.port ? (
                <Link
                  href={`/ports/${voyage.port.id}`}
                  className="font-medium hover:text-brass hover:underline"
                >
                  {voyage.port.name}
                </Link>
              ) : (
                <p className="text-muted-foreground">Unassigned</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-brass">
              <UserRound className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Owner (captain)
              </p>
              {voyage.captain ? (
                <Link
                  href={`/captains?captain=${voyage.captain.id}`}
                  className="font-medium hover:text-brass hover:underline"
                >
                  {captainName(voyage.captain)}
                </Link>
              ) : (
                <p className="text-muted-foreground">Unassigned</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <NavigatorPanel
        voyageId={voyage.id}
        tides={tides}
        nextAction={nextAction}
        configured={hasGatewayKey()}
      />

      {voyage.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {voyage.notes}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Activity</CardTitle>
            <CardDescription>
              The latest entries logged against this voyage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {voyage.activities.length === 0 ? (
              <EmptyState
                icon={ScrollText}
                title="Nothing logged yet"
                description="Calls, emails, and notes against this voyage will show here."
                className="py-10"
              />
            ) : (
              <ul className="space-y-4">
                {voyage.activities.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-brass">
                      <ScrollText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{a.subject}</p>
                        <Badge variant="outline" className="text-[10px]">
                          {ACTIVITY_LABEL[a.type as ActivityType]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatWhen(a.occurredAt)}
                        {a.captain ? ` · ${captainName(a.captain)}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Stage history */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Stage history</CardTitle>
            <CardDescription>
              The voyage&apos;s wake through the stages.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {voyage.stageHistory.length === 0 ? (
              <EmptyState
                icon={Anchor}
                title="No moves recorded"
                description="Stage changes will be charted here as the voyage progresses."
                className="py-10"
              />
            ) : (
              <ul className="space-y-4">
                {voyage.stageHistory.map((e) => {
                  const toMeta = stageMeta(e.toStage as VoyageStage);
                  const fromMeta = e.fromStage
                    ? stageMeta(e.fromStage as VoyageStage)
                    : null;
                  return (
                    <li key={e.id} className="flex items-center gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-brass">
                        <Anchor className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-sm">
                          {fromMeta ? (
                            <>
                              <Badge variant={SIGNAL_BADGE[fromMeta.accent]}>
                                {fromMeta.label}
                              </Badge>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Charted as
                            </span>
                          )}
                          <Badge variant={SIGNAL_BADGE[toMeta.accent]}>
                            {toMeta.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatWhen(e.createdAt)}
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

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-brass">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="font-display text-lg font-bold leading-none truncate">
            {value}
          </div>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
