"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2, Plus } from "lucide-react";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ACTIVITY_LABEL,
  ACTIVITY_TYPES,
  activitySchema,
  type ActivityFormValues,
  type ActivityInput,
  type ActivityTarget,
} from "@/lib/activity";
import { createActivity } from "./actions";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * A compact composer to log a note or task against a port, captain, or voyage
 * from any detail page. On success it refreshes the route so the timeline (and
 * the Orders board) update without a full page reload.
 */
export function QuickAddActivity({
  target,
  targetId,
}: {
  target: ActivityTarget;
  targetId: string;
}) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);

  const idField: keyof ActivityFormValues =
    target === "port"
      ? "portId"
      : target === "captain"
        ? "captainId"
        : "voyageId";

  const blank = React.useCallback(
    (): ActivityFormValues => ({
      type: "NOTE",
      subject: "",
      body: "",
      dueAt: "",
      [idField]: targetId,
    }),
    [idField, targetId],
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ActivityFormValues, unknown, ActivityInput>({
    resolver: zodResolver(activitySchema),
    defaultValues: blank(),
  });

  const type = watch("type");

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await createActivity(values);
    if (result.ok) {
      reset(blank());
      router.refresh();
      return;
    }
    if (result.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        if (messages?.[0]) {
          setError(field as keyof ActivityFormValues, {
            message: messages[0],
          });
        }
      }
    }
    setFormError(result.error);
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      {/* Keep the target id in the payload. */}
      <input type="hidden" {...register(idField)} value={targetId} readOnly />

      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <FormField id="activity-type" label="Type" error={errors.type?.message}>
          <select
            id="activity-type"
            className={selectClass}
            aria-invalid={Boolean(errors.type)}
            {...register("type")}
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_LABEL[t]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          id="activity-subject"
          label="Subject"
          required
          error={errors.subject?.message}
        >
          <Input
            id="activity-subject"
            placeholder="Followed up on terms…"
            aria-invalid={Boolean(errors.subject)}
            {...register("subject")}
          />
        </FormField>
      </div>

      {type === "TASK" ? (
        <FormField
          id="activity-dueAt"
          label="Due date"
          error={errors.dueAt?.message}
        >
          <Input id="activity-dueAt" type="date" {...register("dueAt")} />
        </FormField>
      ) : null}

      <FormField
        id="activity-body"
        label="Details"
        error={errors.body?.message}
      >
        <Textarea
          id="activity-body"
          placeholder="Anything worth logging…"
          className="min-h-[60px]"
          {...register("body")}
        />
      </FormField>

      {formError ? (
        <p role="alert" className="text-sm font-medium text-signal-red">
          {formError}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" variant="brass" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {type === "TASK" ? "Add task" : "Log entry"}
        </Button>
      </div>
    </form>
  );
}
