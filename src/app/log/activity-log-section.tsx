import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ActivityTarget } from "@/lib/activity";
import { ActivityTimeline, type TimelineActivity } from "./activity-timeline";
import { QuickAddActivity } from "./quick-add-activity";

/**
 * The Captain's Log for one entity: a quick-add composer over a
 * reverse-chronological timeline. Drop this onto a port / captain / voyage
 * detail page with a single line — it owns its own card and heading.
 */
export function ActivityLogSection({
  target,
  targetId,
  activities,
  title = "Captain's Log",
  description = "Log notes, calls, and tasks — newest first.",
}: {
  target: ActivityTarget;
  targetId: string;
  activities: TimelineActivity[];
  title?: string;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <QuickAddActivity target={target} targetId={targetId} />
        <div className="border-t pt-4">
          <ActivityTimeline activities={activities} />
        </div>
      </CardContent>
    </Card>
  );
}
