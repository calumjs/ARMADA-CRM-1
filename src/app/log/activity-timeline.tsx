"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ScrollText, Undo2 } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_ICON,
  ACTIVITY_LABEL,
  formatWhen,
  isOverdue,
  type ActivityType,
} from "@/lib/activity";
import { setTaskDone } from "./actions";

export interface TimelineActivity {
  id: string;
  type: ActivityType;
  subject: string;
  body: string | null;
  occurredAt: string | Date;
  done: boolean;
  dueAt: string | Date | null;
  /** Display name of who logged it, if known. */
  author: string | null;
}

/**
 * A reverse-chronological "Captain's Log" timeline. Activities arrive
 * already sorted newest-first; tasks can be marked complete inline, which
 * refreshes the route so the feed updates without a full page reload.
 */
export function ActivityTimeline({
  activities,
}: {
  activities: TimelineActivity[];
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  async function toggle(id: string, done: boolean) {
    setPending(id);
    const result = await setTaskDone(id, done);
    setPending(null);
    if (result.ok) router.refresh();
  }

  if (activities.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title="Nothing logged yet"
        description="Calls, emails, notes, and tasks will show here in the order they happened."
        className="py-10"
      />
    );
  }

  return (
    <ul className="space-y-4">
      {activities.map((a) => {
        const Icon = ACTIVITY_ICON[a.type];
        const overdue = isOverdue(a);
        const isTask = a.type === "TASK";
        return (
          <li key={a.id} className="flex gap-3">
            <span
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                a.done && isTask
                  ? "bg-signal-green/15 text-signal-green"
                  : "bg-secondary text-brass",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className={cn(
                    "font-medium",
                    a.done && isTask && "text-muted-foreground line-through",
                  )}
                >
                  {a.subject}
                </p>
                <Badge variant="outline" className="text-[10px]">
                  {ACTIVITY_LABEL[a.type]}
                </Badge>
                {overdue ? (
                  <Badge variant="signal-red" className="text-[10px]">
                    Overdue
                  </Badge>
                ) : null}
              </div>
              {a.body ? (
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">
                  {a.body}
                </p>
              ) : null}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isTask && a.dueAt
                  ? `Due ${formatWhen(a.dueAt)}`
                  : formatWhen(a.occurredAt)}
                {a.author ? ` · ${a.author}` : ""}
              </p>
            </div>
            {isTask ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending === a.id}
                onClick={() => toggle(a.id, !a.done)}
                className={cn(
                  "shrink-0",
                  a.done
                    ? "text-muted-foreground"
                    : "text-signal-green hover:text-signal-green",
                )}
                aria-label={a.done ? "Reopen task" : "Mark task complete"}
              >
                {a.done ? (
                  <>
                    <Undo2 className="h-4 w-4" />
                    Reopen
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Done
                  </>
                )}
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
