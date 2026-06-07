import Link from "next/link";
import { Compass } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function VoyageNotFound() {
  return (
    <Card className="mx-auto max-w-lg">
      <EmptyState
        icon={Compass}
        title="Voyage not found"
        description="This voyage may have been scuttled, or the link is off course."
        action={
          <Button asChild variant="brass">
            <Link href="/voyages">Back to The Passage</Link>
          </Button>
        }
      />
    </Card>
  );
}
