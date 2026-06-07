import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function VoyagesLoading() {
  return (
    <div>
      <PageHeader
        title="The Passage"
        subtitle="Your deals in flight, charted from Charted to Anchored."
      />
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-flow-col auto-cols-[minmax(15rem,1fr)] gap-4 overflow-x-auto">
          {Array.from({ length: 6 }).map((_, col) => (
            <div key={col} className="space-y-2 rounded-lg border p-3">
              <Skeleton className="h-6 w-full" />
              {Array.from({ length: 3 }).map((_, row) => (
                <Skeleton key={row} className="h-24 w-full rounded-md" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
