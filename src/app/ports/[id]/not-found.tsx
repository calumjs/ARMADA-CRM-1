import Link from "next/link";
import { Compass } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function PortNotFound() {
  return (
    <Card className="mx-auto max-w-lg">
      <EmptyState
        icon={Compass}
        title="Port not found"
        description="This port may have been scuttled, or the link is off course."
        action={
          <Button asChild variant="brass">
            <Link href="/ports">Back to all ports</Link>
          </Button>
        }
      />
    </Card>
  );
}
