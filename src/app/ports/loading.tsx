import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function PortsLoading() {
  return (
    <div>
      <PageHeader
        title="Ports"
        subtitle="The companies your fleet trades with."
      />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-full max-w-xs" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="rounded-lg border">
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 flex-1" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-5 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
