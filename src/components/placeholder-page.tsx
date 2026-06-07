import { Compass } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export function PlaceholderPage({
  title,
  subtitle,
  note,
}: {
  title: string;
  subtitle: string;
  note: string;
}) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-brass">
            <Compass className="h-6 w-6" />
          </span>
          <p className="max-w-md text-sm text-muted-foreground">{note}</p>
        </CardContent>
      </Card>
    </div>
  );
}
