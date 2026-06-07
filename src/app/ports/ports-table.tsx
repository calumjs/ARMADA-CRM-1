"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  compareBy,
  matchesQuery,
  type PortSortKey,
  type SortDirection,
} from "@/lib/ports";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { deletePort } from "./actions";
import { PortDialog, type PortDialogData } from "./port-dialog";

export interface PortRow {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  location: string | null;
  notes: string | null;
  captainCount: number;
  openVoyageCount: number;
}

const COLUMNS: { key: PortSortKey; label: string; numeric?: boolean }[] = [
  { key: "name", label: "Port" },
  { key: "industry", label: "Industry" },
  { key: "captains", label: "Captains", numeric: true },
  { key: "openVoyages", label: "Open voyages", numeric: true },
];

export function PortsTable({ ports }: { ports: PortRow[] }) {
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<PortSortKey>("name");
  const [sortDir, setSortDir] = React.useState<SortDirection>("asc");

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PortDialogData | null>(null);
  const [deleting, setDeleting] = React.useState<PortRow | null>(null);

  const visible = React.useMemo(() => {
    const filtered = ports.filter((p) =>
      matchesQuery([p.name, p.industry, p.location], query),
    );
    const sortValue = (p: PortRow): string | number => {
      switch (sortKey) {
        case "name":
          return p.name;
        case "industry":
          return p.industry ?? "";
        case "captains":
          return p.captainCount;
        case "openVoyages":
          return p.openVoyageCount;
      }
    };
    return [...filtered].sort((a, b) =>
      compareBy(sortValue(a), sortValue(b), sortDir),
    );
  }, [ports, query, sortKey, sortDir]);

  function toggleSort(key: PortSortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "captains" || key === "openVoyages" ? "desc" : "asc");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ports by name, industry, or waters…"
          className="sm:max-w-xs"
          aria-label="Search ports"
        />
        <Button variant="brass" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Chart a port
        </Button>
      </div>

      {ports.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No ports charted yet"
          description="Add the companies your fleet trades with to start building your CRM."
          action={
            <Button variant="brass" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Chart your first port
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No ports match your search"
          description="Try a different name, industry, or home waters."
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
                    numeric={col.numeric}
                    onClick={() => toggleSort(col.key)}
                  />
                ))}
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/ports/${p.id}`}
                      className="hover:text-brass hover:underline"
                    >
                      {p.name}
                    </Link>
                    {p.location ? (
                      <span className="block text-xs text-muted-foreground">
                        {p.location}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.industry ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.captainCount}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.openVoyageCount > 0 ? (
                      <Badge variant="signal-blue">{p.openVoyageCount}</Badge>
                    ) : (
                      <span className="tabular-nums text-muted-foreground">
                        0
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Actions for ${p.name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/ports/${p.id}`}>View port</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setEditing(p)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-signal-red focus:text-signal-red"
                          onSelect={() => setDeleting(p)}
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

      <PortDialog open={createOpen} onOpenChange={setCreateOpen} />
      <PortDialog
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        port={editing}
      />
      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Scuttle this port?"
        description={
          deleting ? (
            <>
              <strong>{deleting.name}</strong> will be removed. Its captains and
              voyages are kept but cut loose from this port.
            </>
          ) : null
        }
        onConfirm={() => deletePort(deleting!.id)}
      />
    </div>
  );
}

function SortableHead({
  label,
  active,
  dir,
  numeric,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDirection;
  numeric?: boolean;
  onClick: () => void;
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={cn(numeric && "text-right")}>
      <button
        type="button"
        onClick={onClick}
        aria-label={`Sort by ${label}`}
        className={cn(
          "inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground",
          numeric && "flex-row-reverse",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <Icon className="h-3.5 w-3.5" />
      </button>
    </TableHead>
  );
}
