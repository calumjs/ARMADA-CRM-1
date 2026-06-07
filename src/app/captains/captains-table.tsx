"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Users,
} from "lucide-react";

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { EmptyState } from "@/components/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  captainInitials,
  captainName,
  compareBy,
  matchesQuery,
  type CaptainSortKey,
  type SortDirection,
} from "@/lib/ports";
import { stageMeta, type VoyageStage } from "@/lib/voyage";
import { ActivityLogSection } from "@/app/log/activity-log-section";
import type { TimelineActivity } from "@/app/log/activity-timeline";
import { deleteCaptain } from "@/app/ports/actions";
import {
  CaptainDialog,
  type CaptainDialogData,
  type PortOption,
} from "./captain-dialog";

const SIGNAL_BADGE = {
  blue: "signal-blue",
  yellow: "signal-yellow",
  green: "signal-green",
  red: "signal-red",
  white: "secondary",
} as const;

export interface CaptainVoyage {
  id: string;
  name: string;
  stage: VoyageStage;
  value: number;
}

export interface CaptainRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  notes: string | null;
  portId: string | null;
  portName: string | null;
  voyages: CaptainVoyage[];
  activities: TimelineActivity[];
}

const COLUMNS: { key: CaptainSortKey; label: string }[] = [
  { key: "name", label: "Captain" },
  { key: "title", label: "Role" },
  { key: "email", label: "Email" },
  { key: "port", label: "Port" },
];

export function CaptainsTable({
  captains,
  ports,
}: {
  captains: CaptainRow[];
  ports: PortOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<CaptainSortKey>("name");
  const [sortDir, setSortDir] = React.useState<SortDirection>("asc");

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CaptainDialogData | null>(null);
  const [deleting, setDeleting] = React.useState<CaptainRow | null>(null);

  // Deep-link: /captains?captain=<id> opens that captain's drawer.
  const selectedId = searchParams.get("captain");
  const selected = React.useMemo(
    () => captains.find((c) => c.id === selectedId) ?? null,
    [captains, selectedId],
  );

  function openCaptain(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("captain", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function closeCaptain() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("captain");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const visible = React.useMemo(() => {
    const filtered = captains.filter((c) =>
      matchesQuery(
        [c.firstName, c.lastName, c.email, c.title, c.portName],
        query,
      ),
    );
    const sortValue = (c: CaptainRow): string => {
      switch (sortKey) {
        case "name":
          return `${c.lastName} ${c.firstName}`;
        case "title":
          return c.title ?? "";
        case "email":
          return c.email ?? "";
        case "port":
          return c.portName ?? "";
      }
    };
    return [...filtered].sort((a, b) =>
      compareBy(sortValue(a), sortValue(b), sortDir),
    );
  }, [captains, query, sortKey, sortDir]);

  function toggleSort(key: CaptainSortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toDialogData(c: CaptainRow): CaptainDialogData {
    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      title: c.title,
      notes: c.notes,
      portId: c.portId,
    };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search captains by name, role, email, or port…"
          className="sm:max-w-sm"
          aria-label="Search captains"
        />
        <Button variant="brass" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Sign on a captain
        </Button>
      </div>

      {captains.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No captains aboard yet"
          description="Sign on the people you deal with at each port to build your contact book."
          action={
            <Button variant="brass" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Sign on your first captain
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No captains match your search"
          description="Try a different name, role, email, or port."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.map((col) => (
                  <SortableHead
                    key={col.key}
                    label={col.label}
                    active={sortKey === col.key}
                    dir={sortDir}
                    onClick={() => toggleSort(col.key)}
                  />
                ))}
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => openCaptain(c.id)}
                      className="flex items-center gap-3 text-left"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-navy text-navy-foreground text-xs">
                          {captainInitials(c)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium hover:text-brass hover:underline">
                        {captainName(c)}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.title ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.email ?? "—"}
                  </TableCell>
                  <TableCell>
                    {c.portId && c.portName ? (
                      <Link
                        href={`/ports/${c.portId}`}
                        className="hover:text-brass hover:underline"
                      >
                        {c.portName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Actions for ${captainName(c)}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => openCaptain(c.id)}>
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setEditing(toDialogData(c))}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-signal-red focus:text-signal-red"
                          onSelect={() => setDeleting(c)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail drawer */}
      <Sheet
        open={Boolean(selected)}
        onOpenChange={(o) => !o && closeCaptain()}
      >
        <SheetContent>
          {selected ? (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-navy text-navy-foreground">
                      {captainInitials(selected)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <SheetTitle>{captainName(selected)}</SheetTitle>
                    {selected.title ? (
                      <SheetDescription>{selected.title}</SheetDescription>
                    ) : null}
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <section className="space-y-2 text-sm">
                  <DetailRow icon={Mail} label="Email">
                    {selected.email ? (
                      <a
                        href={`mailto:${selected.email}`}
                        className="hover:text-brass hover:underline"
                      >
                        {selected.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </DetailRow>
                  <DetailRow icon={Phone} label="Phone">
                    {selected.phone ?? "—"}
                  </DetailRow>
                  <DetailRow icon={Building2} label="Port">
                    {selected.portId && selected.portName ? (
                      <Link
                        href={`/ports/${selected.portId}`}
                        className="hover:text-brass hover:underline"
                        onClick={closeCaptain}
                      >
                        {selected.portName}
                      </Link>
                    ) : (
                      "Unassigned"
                    )}
                  </DetailRow>
                </section>

                {selected.notes ? (
                  <section>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Notes
                    </h3>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {selected.notes}
                    </p>
                  </section>
                ) : null}

                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Voyages
                  </h3>
                  {selected.voyages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No voyages linked to this captain.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {selected.voyages.map((v) => {
                        const meta = stageMeta(v.stage);
                        return (
                          <li
                            key={v.id}
                            className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                          >
                            <span className="font-medium">{v.name}</span>
                            <Badge variant={SIGNAL_BADGE[meta.accent]}>
                              {meta.label}
                            </Badge>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <ActivityLogSection
                  target="captain"
                  targetId={selected.id}
                  title="Captain's Log"
                  description="Notes, calls, and tasks for this captain — newest first."
                  activities={selected.activities}
                />
              </div>

              <SheetFooter className="mt-8">
                <Button
                  variant="secondary"
                  onClick={() => {
                    const data = toDialogData(selected);
                    closeCaptain();
                    setEditing(data);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  className="text-signal-red hover:text-signal-red"
                  onClick={() => {
                    const row = selected;
                    closeCaptain();
                    setDeleting(row);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <CaptainDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        ports={ports}
      />
      <CaptainDialog
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        captain={editing}
        ports={ports}
      />
      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Strike this captain?"
        confirmLabel="Strike captain"
        description={
          deleting ? (
            <>
              <strong>{captainName(deleting)}</strong> will be removed from the
              fleet. Their voyages are kept but cut loose.
            </>
          ) : null
        }
        onConfirm={() => deleteCaptain(deleting!.id)}
      />
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </div>
  );
}

function SortableHead({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDirection;
  onClick: () => void;
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead>
      <button
        type="button"
        onClick={onClick}
        aria-label={`Sort by ${label}`}
        className={cn(
          "inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <Icon className="h-3.5 w-3.5" />
      </button>
    </TableHead>
  );
}
