"use client";

import * as React from "react";
import Link from "next/link";
import { Anchor, ArrowRight, Building2, Compass } from "lucide-react";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/activity";
import { formatValue, type VoyageStage } from "@/lib/voyage";
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  coastlinePath,
  harbourLineX,
  layoutFleet,
  type ChartShip,
  type ChartVoyage,
} from "@/lib/chart";

const SIGNAL_BADGE = {
  blue: "signal-blue",
  yellow: "signal-yellow",
  green: "signal-green",
  red: "signal-red",
  white: "secondary",
} as const;

/** Hull fill per signal-flag accent (CSS variables from the design system). */
const HULL_FILL: Record<ChartShip["accent"], string> = {
  green: "hsl(var(--signal-green))",
  yellow: "hsl(var(--signal-yellow))",
  red: "hsl(var(--signal-red))",
  white: "hsl(var(--muted-foreground))",
};

/** Respect the user's reduced-motion preference for ambient animation. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(true);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** A gentle animation clock (seconds). Stops entirely when motion is reduced. */
function useChartClock(enabled: boolean): number {
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let mounted = true;
    const start = performance.now();
    const tick = (now: number) => {
      if (!mounted) return;
      setT((now - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
    };
  }, [enabled]);
  return t;
}

export interface FleetChartProps {
  voyages: ChartVoyage[];
  /** Stable seed (repo identity) so the coastline is consistent run-to-run. */
  seed: string;
}

export function FleetChart({ voyages, seed }: FleetChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  const t = useChartClock(!reducedMotion);

  const ships = React.useMemo(
    () => layoutFleet(voyages, seed),
    [voyages, seed],
  );
  const coast = React.useMemo(() => coastlinePath(seed), [seed]);
  const harbour = harbourLineX();

  const [hovered, setHovered] = React.useState<ChartShip | null>(null);
  const [selected, setSelected] = React.useState<ChartShip | null>(null);

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-lg border bg-card shadow-sm">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="block aspect-[5/3] w-full"
          role="img"
          aria-label={`Fleet chart of ${ships.length} active ${
            ships.length === 1 ? "voyage" : "voyages"
          } sailing toward harbour.`}
          onMouseLeave={() => setHovered(null)}
        >
          <defs>
            <linearGradient id="sea" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="hsl(var(--navy))" />
              <stop offset="100%" stopColor="hsl(var(--primary))" />
            </linearGradient>
            <linearGradient id="land" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--brass) / 0.55)" />
              <stop offset="100%" stopColor="hsl(var(--brass) / 0.85)" />
            </linearGradient>
          </defs>

          {/* Open sea */}
          <rect
            x={0}
            y={0}
            width={CHART_WIDTH}
            height={CHART_HEIGHT}
            fill="url(#sea)"
          />

          {/* Subtle latitude/longitude grid for the chart feel */}
          <Graticule />

          {/* Swell lines drifting toward the harbour */}
          <Swell t={t} />

          {/* Harbour line: the goal ships sail toward */}
          <line
            x1={harbour}
            y1={0}
            x2={harbour}
            y2={CHART_HEIGHT}
            stroke="hsl(var(--brass) / 0.4)"
            strokeWidth={1.5}
            strokeDasharray="4 8"
          />

          {/* Procedurally generated coastline / harbour on the right */}
          <path
            d={coast}
            fill="url(#land)"
            stroke="hsl(var(--brass))"
            strokeWidth={2}
          />
          <text
            x={CHART_WIDTH * 0.88}
            y={CHART_HEIGHT * 0.5}
            textAnchor="middle"
            className="fill-brass-foreground font-display"
            fontSize={22}
            fontWeight={700}
            opacity={0.8}
          >
            HARBOUR
          </text>
          <text
            x={CHART_WIDTH * 0.06}
            y={26}
            className="fill-parchment-foreground font-display"
            fontSize={16}
            opacity={0.6}
          >
            OPEN SEA
          </text>

          {/* The fleet */}
          {ships.map((ship) => (
            <ShipGlyph
              key={ship.id}
              ship={ship}
              t={t}
              reducedMotion={reducedMotion}
              hovered={hovered?.id === ship.id}
              onHover={() => setHovered(ship)}
              onLeave={() =>
                setHovered((h) => (h?.id === ship.id ? null : h))
              }
              onSelect={() => setSelected(ship)}
            />
          ))}
        </svg>

        {hovered ? <ShipTooltip ship={hovered} /> : null}

        {ships.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-md bg-card/80 px-4 py-2 text-sm text-muted-foreground backdrop-blur">
              No active voyages in flight. Chart one on The Passage.
            </p>
          </div>
        ) : null}
      </div>

      <Legend count={ships.length} />

      <VoyageDrawer
        ship={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}

/** A single ship — hull + sail — positioned and gently bobbing. */
function ShipGlyph({
  ship,
  t,
  reducedMotion,
  hovered,
  onHover,
  onLeave,
  onSelect,
}: {
  ship: ChartShip;
  t: number;
  reducedMotion: boolean;
  hovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onSelect: () => void;
}) {
  // Ambient bob (vertical) + tiny drift (horizontal). Stormy ships rock harder.
  const sway = ship.weather === "stormy" ? 2.4 : ship.weather === "fair" ? 1.4 : 0.8;
  const speed = ship.weather === "stormy" ? 2.6 : 1.6;
  const ph = ship.phase * Math.PI * 2;
  const bob = reducedMotion ? 0 : Math.sin(t * speed + ph) * sway;
  const drift = reducedMotion ? 0 : Math.cos(t * speed * 0.7 + ph) * sway * 0.6;
  const tilt = reducedMotion
    ? 0
    : Math.sin(t * speed + ph) * (ship.weather === "stormy" ? 6 : 2.5);

  const s = ship.size;
  const fill = HULL_FILL[ship.accent];

  return (
    <g
      transform={`translate(${ship.x + drift} ${ship.y + bob}) rotate(${tilt})`}
      tabIndex={0}
      role="button"
      aria-label={`${ship.name}, ${ship.stageLabel}, ${formatValue(
        ship.value,
      )}${ship.portName ? `, ${ship.portName}` : ""}. Open voyage.`}
      className="cursor-pointer outline-none [transition:filter_150ms]"
      style={{
        filter: hovered
          ? "drop-shadow(0 0 6px hsl(var(--brass)))"
          : undefined,
      }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onFocus={onHover}
      onBlur={onLeave}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* Generous invisible hit-area for easy hovering/tapping */}
      <circle cx={0} cy={0} r={s + 8} fill="transparent" />

      {/* Wake */}
      <path
        d={`M ${-s} 0 q ${-s * 1.4} ${-s * 0.5} ${-s * 2.4} 0 q ${s * 1.4} ${
          s * 0.5
        } ${s * 2.4} 0 Z`}
        fill="hsl(var(--signal-white) / 0.18)"
      />

      {/* Hull */}
      <path
        d={`M ${-s} ${-s * 0.18} L ${s} ${-s * 0.18} L ${s * 0.6} ${
          s * 0.42
        } L ${-s * 0.7} ${s * 0.42} Z`}
        fill={fill}
        stroke="hsl(var(--navy))"
        strokeWidth={1}
      />
      {/* Mast */}
      <line
        x1={0}
        y1={-s * 0.18}
        x2={0}
        y2={-s * 1.2}
        stroke="hsl(var(--brass-foreground))"
        strokeWidth={1.5}
      />
      {/* Sail */}
      <path
        d={`M ${1} ${-s * 1.15} L ${1} ${-s * 0.22} L ${s * 0.85} ${
          -s * 0.32
        } Z`}
        fill="hsl(var(--signal-white) / 0.9)"
        stroke="hsl(var(--navy) / 0.4)"
        strokeWidth={0.75}
      />

      {/* Storm cloud over a stalled ship */}
      {ship.weather === "stormy" ? (
        <g opacity={0.85}>
          <ellipse
            cx={0}
            cy={-s * 1.7}
            rx={s * 0.9}
            ry={s * 0.4}
            fill="hsl(var(--muted-foreground))"
          />
          <line
            x1={-s * 0.2}
            y1={-s * 1.45}
            x2={-s * 0.4}
            y2={-s * 1.0}
            stroke="hsl(var(--signal-yellow))"
            strokeWidth={1.5}
          />
        </g>
      ) : null}
    </g>
  );
}

/** Faint chart graticule. */
function Graticule() {
  const lines: React.ReactElement[] = [];
  for (let i = 1; i < 10; i++) {
    const x = (CHART_WIDTH / 10) * i;
    lines.push(
      <line
        key={`v${i}`}
        x1={x}
        y1={0}
        x2={x}
        y2={CHART_HEIGHT}
        stroke="hsl(var(--signal-white) / 0.05)"
        strokeWidth={1}
      />,
    );
  }
  for (let i = 1; i < 6; i++) {
    const y = (CHART_HEIGHT / 6) * i;
    lines.push(
      <line
        key={`h${i}`}
        x1={0}
        y1={y}
        x2={CHART_WIDTH}
        y2={y}
        stroke="hsl(var(--signal-white) / 0.05)"
        strokeWidth={1}
      />,
    );
  }
  return <g aria-hidden>{lines}</g>;
}

/** Slow swell lines that drift to give the sea life (animated by `t`). */
function Swell({ t }: { t: number }) {
  const rows = [0.2, 0.45, 0.7, 0.9];
  return (
    <g aria-hidden opacity={0.12}>
      {rows.map((r, i) => {
        const y = CHART_HEIGHT * r;
        const offset = (t * (8 + i * 3)) % 120;
        return (
          <path
            key={i}
            d={`M ${-120 + offset} ${y} q 30 -6 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0`}
            fill="none"
            stroke="hsl(var(--signal-white))"
            strokeWidth={1.5}
          />
        );
      })}
    </g>
  );
}

/** HTML tooltip overlaid on the SVG, positioned by the ship's logical coords. */
function ShipTooltip({ ship }: { ship: ChartShip }) {
  const leftPct = (ship.x / CHART_WIDTH) * 100;
  const topPct = (ship.y / CHART_HEIGHT) * 100;
  // Flip to the left when the ship is near the right edge.
  const flip = leftPct > 70;
  return (
    <div
      className="pointer-events-none absolute z-10 w-48 rounded-md border bg-popover p-3 text-popover-foreground shadow-lg"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: `translate(${flip ? "-100%" : "0"}, calc(-100% - 12px))`,
      }}
      role="status"
    >
      <p className="truncate font-display text-sm font-semibold">{ship.name}</p>
      <dl className="mt-1.5 space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center justify-between gap-2">
          <dt>Port</dt>
          <dd className="truncate text-foreground">
            {ship.portName ?? "Unassigned"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt>Value</dt>
          <dd className="font-mono text-foreground">
            {formatValue(ship.value)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt>Stage</dt>
          <dd className="text-foreground">{ship.stageLabel}</dd>
        </div>
      </dl>
    </div>
  );
}

/** A small key explaining what the visual encodes. */
function Legend({ count }: { count: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <Compass className="h-3.5 w-3.5 text-brass" />
        {count} active {count === 1 ? "voyage" : "voyages"}
      </span>
      <span>Position = stage (open sea → harbour)</span>
      <span>Size = value</span>
      <span className="inline-flex items-center gap-1.5">
        <Dot className="bg-signal-green" /> calm
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Dot className="bg-signal-yellow" /> closing soon
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Dot className="bg-signal-red" /> stormy / overdue
      </span>
    </div>
  );
}

function Dot({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-2.5 w-2.5 rounded-full", className)}
    />
  );
}

/** Detail drawer opened when a ship is clicked. */
function VoyageDrawer({
  ship,
  onOpenChange,
}: {
  ship: ChartShip | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={Boolean(ship)} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        {ship ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-brass">
                  <Anchor className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <SheetTitle className="truncate">{ship.name}</SheetTitle>
                  <SheetDescription>{ship.stageLabel}</SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={SIGNAL_BADGE[ship.accent]}>
                  {ship.weather === "stormy"
                    ? "Stormy seas"
                    : ship.weather === "fair"
                      ? "Closing soon"
                      : "Calm seas"}
                </Badge>
                <Badge variant="outline">{stageBadgeLabel(ship.stage)}</Badge>
              </div>

              <dl className="grid grid-cols-2 gap-3">
                <Field label="Value">{formatValue(ship.value)}</Field>
                <Field label="Stage">{ship.stageLabel}</Field>
                <Field label="Port">
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    {ship.portName ?? "Unassigned"}
                  </span>
                </Field>
                <Field label="Expected close">
                  {ship.expectedClose ? formatDate(ship.expectedClose) : "—"}
                </Field>
              </dl>

              <SheetClose asChild>
                <Link
                  href={`/voyages/${ship.id}`}
                  className={cn(
                    buttonVariants({ variant: "brass" }),
                    "w-full",
                  )}
                >
                  Open voyage detail
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </SheetClose>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function stageBadgeLabel(stage: VoyageStage): string {
  return stage.charAt(0) + stage.slice(1).toLowerCase();
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium">{children}</dd>
    </div>
  );
}
