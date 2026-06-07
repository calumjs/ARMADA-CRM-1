"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ClipboardList,
  Loader2,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatWhen, isOverdue, sortTasksByDue } from "@/lib/activity";
import { setTaskDone } from "@/app/log/actions";

export interface OrderTask {
  id: string;
  subject: string;
  body: string | null;
  done: boolean;
  dueAt: string | null;
  createdAt: string;
  author: string | null;
  port: { id: string; name: string } | null;
  voyage: { id: string; name: string } | null;
}

/**
 * The Orders board: every open task, sortable by due date, overdue rows
 * flagged. Completing a task inline persists and refreshes so it drops off
 * the open list without a full page reload.
 */
export function OrdersBoard({ tasks }: { tasks: OrderTask[] }) {
  const router = useRouter();
  const [dir, setDir] = React.useState<"asc" | "desc">("asc");
  const [pending, setPending] = React.useState<string | null>(null);

  const sorted = React.useMemo(() => sortTasksByDue(tasks, dir), [tasks, dir]);

  async function complete(id: string) {
    setPending(id);
    const result = await setTaskDone(id, true);
    setPending(null);
    if (result.ok) router.refresh();
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No open orders"
        description="Tasks logged against ports, captains, and voyages will muster here until they're done."
      />
    );
  }

  const DirIcon = dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Against</TableHead>
            <TableHead>
              <button
                type="button"
                onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}
                aria-label="Sort by due date"
                className="inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:text-foreground"
              >
                Due
                <DirIcon className="h-3.5 w-3.5" />
              </button>
            </TableHead>
            <TableHead className="w-24 text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((t) => {
            const overdue = isOverdue(t);
            return (
              <TableRow key={t.id} className={cn(overdue && "bg-signal-red/5")}>
                <TableCell>
                  <div className="font-medium">{t.subject}</div>
                  {t.author ? (
                    <div className="text-xs text-muted-foreground">
                      {t.author}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm">
                  {t.voyage ? (
                    <Link
                      href={`/voyages/${t.voyage.id}`}
                      className="hover:text-brass hover:underline"
                    >
                      {t.voyage.name}
                    </Link>
                  ) : t.port ? (
                    <Link
                      href={`/ports/${t.port.id}`}
                      className="hover:text-brass hover:underline"
                    >
                      {t.port.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {t.dueAt ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-2",
                        overdue && "font-medium text-signal-red",
                      )}
                    >
                      {formatWhen(t.dueAt)}
                      {overdue ? (
                        <Badge variant="signal-red" className="text-[10px]">
                          Overdue
                        </Badge>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">No due date</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending === t.id}
                    onClick={() => complete(t.id)}
                    className="text-signal-green hover:text-signal-green"
                    aria-label={`Mark "${t.subject}" complete`}
                  >
                    {pending === t.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Done
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
