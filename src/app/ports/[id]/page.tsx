import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Anchor,
  ArrowLeft,
  Building2,
  Globe,
  MapPin,
  ScrollText,
  Users,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { toTimelineActivity } from "@/lib/activity";
import { ActivityLogSection } from "@/app/log/activity-log-section";
import { captainInitials, captainName } from "@/lib/ports";
import { formatValue, stageMeta, type VoyageStage } from "@/lib/voyage";
import { PortDetailActions } from "./port-detail-actions";

export const dynamic = "force-dynamic";

const SIGNAL_BADGE = {
  blue: "signal-blue",
  yellow: "signal-yellow",
  green: "signal-green",
  red: "signal-red",
  white: "secondary",
} as const;

async function loadPort(id: string) {
  try {
    return await prisma.port.findUnique({
      where: { id },
      include: {
        captains: { orderBy: { lastName: "asc" } },
        voyages: { orderBy: { updatedAt: "desc" }, include: { captain: true } },
        activities: {
          orderBy: { occurredAt: "desc" },
          include: { captain: true },
        },
      },
    });
  } catch {
    return null;
  }
}

export default async function PortDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const port = await loadPort(id);
  if (!port) notFound();

  const openVoyages = port.voyages.filter(
    (v) => stageMeta(v.stage as VoyageStage).open,
  );

  return (
    <div className="space-y-6">
      <Link
        href="/ports"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All ports
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-brass">
              <Building2 className="h-6 w-6" />
            </span>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight">
                {port.name}
              </h1>
              {port.industry ? (
                <p className="text-muted-foreground">{port.industry}</p>
              ) : null}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {port.location ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {port.location}
              </span>
            ) : null}
            {port.website ? (
              <a
                href={port.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-foreground hover:underline"
              >
                <Globe className="h-4 w-4" />
                {port.website.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
          </div>
        </div>
        <PortDetailActions
          port={{
            id: port.id,
            name: port.name,
            industry: port.industry,
            website: port.website,
            location: port.location,
            notes: port.notes,
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat icon={Users} label="Captains" value={port.captains.length} />
        <Stat icon={Anchor} label="Voyages" value={port.voyages.length} />
        <Stat icon={Anchor} label="Open voyages" value={openVoyages.length} />
        <Stat
          icon={ScrollText}
          label="Activities"
          value={port.activities.length}
        />
      </div>

      {port.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {port.notes}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Captains */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Captains</CardTitle>
            <CardDescription>
              The contacts who sail for this port.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {port.captains.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No captains aboard"
                description="Add a captain from the Captains page and assign them here."
                className="py-10"
              />
            ) : (
              <ul className="divide-y">
                {port.captains.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-navy text-navy-foreground text-xs">
                        {captainInitials(c)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/captains?captain=${c.id}`}
                        className="font-medium hover:text-brass hover:underline"
                      >
                        {captainName(c)}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {[c.title, c.email].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Voyages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Voyages</CardTitle>
            <CardDescription>Deals in flight with this port.</CardDescription>
          </CardHeader>
          <CardContent>
            {port.voyages.length === 0 ? (
              <EmptyState
                icon={Anchor}
                title="No voyages charted"
                description="Voyages linked to this port will appear here."
                className="py-10"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Voyage</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {port.voyages.map((v) => {
                    const meta = stageMeta(v.stage as VoyageStage);
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.name}</TableCell>
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

      {/* Captain's Log — quick-add composer over a reverse-chron timeline */}
      <ActivityLogSection
        target="port"
        targetId={port.id}
        title="Captain's Log"
        description="Notes, calls, and tasks logged against this port — newest first."
        activities={port.activities.map(toTimelineActivity)}
      />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-brass">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <div className="font-display text-2xl font-bold leading-none">
            {value}
          </div>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
