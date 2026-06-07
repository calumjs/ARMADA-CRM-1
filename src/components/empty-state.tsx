import { Compass, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * An ARMADA-style empty state: a brass-on-secondary medallion, a headline, and
 * a supporting line, with optional action slot. Used inside cards and lists
 * when there is nothing to show yet.
 */
export function EmptyState({
  icon: Icon = Compass,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-16 text-center",
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-brass">
        <Icon className="h-6 w-6" />
      </span>
      <div className="space-y-1">
        <p className="font-display text-lg font-semibold">{title}</p>
        {description ? (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
