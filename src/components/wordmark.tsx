import { Anchor } from "lucide-react";

import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-navy text-brass">
        <Anchor className="h-5 w-5" />
      </span>
      <span className="font-display text-xl font-bold tracking-tight text-foreground">
        ARMADA
        <span className="ml-1 font-sans text-xs font-medium uppercase tracking-widest text-brass">
          CRM
        </span>
      </span>
    </div>
  );
}
