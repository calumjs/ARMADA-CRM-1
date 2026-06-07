"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Building2,
  CalendarClock,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/activity";
import {
  STAGE_META,
  VOYAGE_STAGES,
  boardSummary,
  formatPercent,
  formatValue,
  voyageHealth,
  type VoyageStage,
} from "@/lib/voyage";
import { tidesScore } from "@/lib/navigator";
import { deleteVoyage, updateVoyageStage } from "./actions";
import {
  VoyageDialog,
  type VoyageDialogData,
  type VoyageOption,
} from "./voyage-dialog";

export interface BoardVoyage {
  id: string;
  name: string;
  stage: VoyageStage;
  value: number;
  expectedClose: string | null;
  portId: string | null;
  portName: string | null;
  captainId: string | null;
  captainName: string | null;
  notes: string | null;
}

const HEALTH_DOT: Record<string, string> = {
  green: "bg-signal-green",
  yellow: "bg-signal-yellow",
  red: "bg-signal-red",
  white: "bg-muted-foreground",
};

const ACCENT_BAR: Record<string, string> = {
  blue: "bg-signal-blue",
  yellow: "bg-signal-yellow",
  green: "bg-signal-green",
  red: "bg-signal-red",
  white: "bg-muted-foreground",
};

export function VoyageBoard({
  voyages: initial,
  ports,
  captains,
}: {
  voyages: BoardVoyage[];
  ports: VoyageOption[];
  captains: VoyageOption[];
}) {
  const router = useRouter();
  const [voyages, setVoyages] = React.useState(initial);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const [createStage, setCreateStage] = React.useState<VoyageStage | null>(
    null,
  );
  const [editing, setEditing] = React.useState<VoyageDialogData | null>(null);
  const [deleting, setDeleting] = React.useState<BoardVoyage | null>(null);

  // Keep local state in sync when the server sends fresh data (after refresh).
  React.useEffect(() => {
    setVoyages(initial);
  }, [initial]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const byStage = React.useMemo(() => {
    const map = new Map<VoyageStage, BoardVoyage[]>();
    for (const stage of VOYAGE_STAGES) map.set(stage, []);
    for (const v of voyages) map.get(v.stage)?.push(v);
    return map;
  }, [voyages]);

  const summary = React.useMemo(() => boardSummary(voyages), [voyages]);
  const active = activeId
    ? (voyages.find((v) => v.id === activeId) ?? null)
    : null;

  async function moveVoyage(id: string, to: VoyageStage) {
    const current = voyages.find((v) => v.id === id);
    if (!current || current.stage === to) return;
    const previous = current.stage;
    // Optimistic: reflect the move immediately.
    setVoyages((vs) => vs.map((v) => (v.id === id ? { ...v, stage: to } : v)));
    const result = await updateVoyageStage(id, to);
    if (!result.ok) {
      // Roll back on failure.
      setVoyages((vs) =>
        vs.map((v) => (v.id === id ? { ...v, stage: previous } : v)),
      );
      return;
    }
    router.refresh();
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active: dragged, over } = event;
    if (!over) return;
    const to = String(over.id) as VoyageStage;
    if (!VOYAGE_STAGES.includes(to)) return;
    void moveVoyage(String(dragged.id), to);
  }

  return (
    <div className="space-y-5">
      <SummaryBar summary={summary} />

      <div className="flex justify-end">
        <Button variant="brass" onClick={() => setCreateStage("CHARTED")}>
          <Plus className="h-4 w-4" />
          Chart a voyage
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="grid grid-flow-col auto-cols-[minmax(15rem,1fr)] gap-4 overflow-x-auto pb-2">
          {VOYAGE_STAGES.map((stage) => (
            <Column
              key={stage}
              stage={stage}
              voyages={byStage.get(stage) ?? []}
              onAdd={() => setCreateStage(stage)}
              onEdit={(v) => setEditing(toDialogData(v))}
              onDelete={(v) => setDeleting(v)}
              onMove={(id, to) => void moveVoyage(id, to)}
            />
          ))}
        </div>

        <DragOverlay>
          {active ? <Card voyage={active} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <VoyageDialog
        open={createStage !== null}
        onOpenChange={(o) => !o && setCreateStage(null)}
        ports={ports}
        captains={captains}
        defaultStage={createStage ?? "CHARTED"}
      />
      <VoyageDialog
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        voyage={editing}
        ports={ports}
        captains={captains}
      />
      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Scuttle this voyage?"
        description={
          deleting ? (
            <>
              <strong>{deleting.name}</strong> will be removed from the board.
              This can&apos;t be undone.
            </>
          ) : null
        }
        onConfirm={() => deleteVoyage(deleting!.id)}
      />
    </div>
  );
}

function SummaryBar({ summary }: { summary: ReturnType<typeof boardSummary> }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Metric
        label="Pipeline value"
        value={formatValue(summary.pipeline)}
        hint={`${summary.open} in flight`}
      />
      <Metric
        label="Weighted forecast"
        value={formatValue(summary.forecast)}
        hint="value × stage odds"
      />
      <Metric
        label="Win rate"
        value={formatPercent(summary.winRate)}
        hint={`${summary.won} won · ${summary.lost} lost`}
      />
      <Metric
        label="Closed"
        value={String(summary.won + summary.lost)}
        hint="anchored or wrecked"
      />
    </dl>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-display text-2xl font-bold leading-none">
        {value}
      </dd>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Column({
  stage,
  voyages,
  onAdd,
  onEdit,
  onDelete,
  onMove,
}: {
  stage: VoyageStage;
  voyages: BoardVoyage[];
  onAdd: () => void;
  onEdit: (v: BoardVoyage) => void;
  onDelete: (v: BoardVoyage) => void;
  onMove: (id: string, to: VoyageStage) => void;
}) {
  const meta = STAGE_META[stage];
  const total = voyages.reduce((sum, v) => sum + v.value, 0);
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <section
      aria-label={`${meta.label} column`}
      className="flex min-w-0 flex-col rounded-lg border bg-muted/30"
    >
      <header className="flex items-start gap-2 border-b p-3">
        <span
          aria-hidden
          className={cn(
            "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
            ACCENT_BAR[meta.accent],
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold">{meta.label}</h2>
            <Badge variant="secondary" className="tabular-nums">
              {voyages.length}
            </Badge>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            {formatValue(total)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          aria-label={`Add a voyage to ${meta.label}`}
          onClick={onAdd}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2 p-2 transition-colors",
          isOver && "bg-brass/10",
        )}
      >
        {voyages.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            No voyages here.
          </p>
        ) : (
          voyages.map((v) => (
            <DraggableCard
              key={v.id}
              voyage={v}
              onEdit={() => onEdit(v)}
              onDelete={() => onDelete(v)}
              onMove={onMove}
            />
          ))
        )}
      </div>
    </section>
  );
}

function DraggableCard({
  voyage,
  onEdit,
  onDelete,
  onMove,
}: {
  voyage: BoardVoyage;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (id: string, to: VoyageStage) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: voyage.id });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-40")}
    >
      <Card
        voyage={voyage}
        onEdit={onEdit}
        onDelete={onDelete}
        onMove={onMove}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function Card({
  voyage,
  onEdit,
  onDelete,
  onMove,
  dragHandleProps,
  overlay,
}: {
  voyage: BoardVoyage;
  onEdit?: () => void;
  onDelete?: () => void;
  onMove?: (id: string, to: VoyageStage) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  overlay?: boolean;
}) {
  const health = voyageHealth(voyage);
  const tides = tidesScore(voyage);

  return (
    <article
      className={cn(
        "rounded-md border bg-card p-3 shadow-sm",
        overlay && "rotate-1 shadow-lg ring-2 ring-brass",
      )}
    >
      <div className="flex items-start gap-2">
        {dragHandleProps ? (
          <button
            type="button"
            className="mt-0.5 -ml-1 cursor-grab touch-none rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
            aria-label={`Move ${voyage.name}`}
            {...dragHandleProps}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                HEALTH_DOT[health.accent],
              )}
              title={health.label}
            />
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold leading-tight">
              {overlay ? (
                voyage.name
              ) : (
                <Link
                  href={`/voyages/${voyage.id}`}
                  className="hover:text-brass hover:underline"
                >
                  {voyage.name}
                </Link>
              )}
            </h3>
          </div>
        </div>
        {onEdit && onDelete && onMove ? (
          <CardMenu
            voyage={voyage}
            onEdit={onEdit}
            onDelete={onDelete}
            onMove={onMove}
          />
        ) : null}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="font-mono text-sm font-medium">
          {formatValue(voyage.value)}
        </p>
        <span
          className="text-xs font-semibold tabular-nums text-muted-foreground"
          title={`Reading the tides: ${tides.rationale}`}
        >
          <span
            aria-hidden
            className={cn(
              "mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle",
              HEALTH_DOT[tides.accent],
            )}
          />
          {tides.score}
        </span>
      </div>

      <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
        {voyage.portName ? (
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{voyage.portName}</span>
          </div>
        ) : null}
        {voyage.captainName ? (
          <div className="flex items-center gap-1.5">
            <UserRound className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{voyage.captainName}</span>
          </div>
        ) : null}
        {voyage.expectedClose ? (
          <div className="flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            <span>{formatDate(voyage.expectedClose)}</span>
          </div>
        ) : null}
      </dl>

      <span className="sr-only" aria-live="off">
        Health: {health.label}
      </span>
    </article>
  );
}

/**
 * Per-card actions. The "Move to" submenu is the keyboard-accessible path for
 * changing a voyage's stage without a pointer drag.
 */
function CardMenu({
  voyage,
  onEdit,
  onDelete,
  onMove,
}: {
  voyage: BoardVoyage;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (id: string, to: VoyageStage) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          aria-label={`Actions for ${voyage.name}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/voyages/${voyage.id}`}>View voyage</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil className="h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {VOYAGE_STAGES.filter((s) => s !== voyage.stage).map((s) => (
              <DropdownMenuItem key={s} onSelect={() => onMove(voyage.id, s)}>
                {STAGE_META[s].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-signal-red focus:text-signal-red"
          onSelect={onDelete}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function toDialogData(v: BoardVoyage): VoyageDialogData {
  return {
    id: v.id,
    name: v.name,
    stage: v.stage,
    value: v.value,
    expectedClose: v.expectedClose,
    portId: v.portId,
    captainId: v.captainId,
    notes: v.notes,
  };
}
