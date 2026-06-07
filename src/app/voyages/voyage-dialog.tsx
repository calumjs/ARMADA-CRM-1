"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Anchor, Loader2 } from "lucide-react";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  STAGE_META,
  VOYAGE_STAGES,
  voyageSchema,
  type VoyageFormValues,
  type VoyageInput,
} from "@/lib/voyage";
import { createVoyage, updateVoyage } from "./actions";

export interface VoyageDialogData {
  id: string;
  name: string;
  stage: string;
  value: number;
  expectedClose: string | null;
  portId: string | null;
  captainId: string | null;
  notes: string | null;
}

export interface VoyageOption {
  id: string;
  name: string;
}

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function VoyageDialog({
  open,
  onOpenChange,
  voyage,
  ports,
  captains,
  defaultStage,
  defaultPortId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When present the dialog edits this voyage; otherwise it creates a new one. */
  voyage?: VoyageDialogData | null;
  ports: VoyageOption[];
  captains: VoyageOption[];
  defaultStage?: string;
  defaultPortId?: string;
}) {
  const router = useRouter();
  const editing = Boolean(voyage);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<VoyageFormValues, unknown, VoyageInput>({
    resolver: zodResolver(voyageSchema),
    defaultValues: blankValues(defaultStage, defaultPortId),
  });

  React.useEffect(() => {
    if (open) {
      reset(
        voyage ? toValues(voyage) : blankValues(defaultStage, defaultPortId),
      );
      setFormError(null);
    }
  }, [open, voyage, defaultStage, defaultPortId, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    // `values` is already the schema's transformed output (VoyageInput).
    const result = voyage
      ? await updateVoyage(voyage.id, values)
      : await createVoyage(values);

    if (result.ok) {
      onOpenChange(false);
      router.refresh();
      return;
    }
    if (result.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        if (messages?.[0]) {
          setError(field as keyof VoyageFormValues, { message: messages[0] });
        }
      }
    }
    setFormError(result.error);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Anchor className="h-5 w-5 text-brass" />
            {editing ? "Edit voyage" : "Chart a new voyage"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this deal's details."
              : "Add a deal and set it on its course."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField
            id="name"
            label="Name"
            required
            error={errors.name?.message}
          >
            <Input
              id="name"
              placeholder="Q3 freight contract"
              aria-invalid={Boolean(errors.name)}
              {...register("name")}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="stage" label="Stage" error={errors.stage?.message}>
              <select
                id="stage"
                className={cn(SELECT_CLASS)}
                {...register("stage")}
              >
                {VOYAGE_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_META[s].label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              id="value"
              label="Value (USD)"
              error={errors.value?.message}
            >
              <Input
                id="value"
                type="number"
                min={0}
                step={1}
                placeholder="120000"
                aria-invalid={Boolean(errors.value)}
                {...register("value")}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="expectedClose"
              label="Expected close"
              error={errors.expectedClose?.message}
            >
              <Input
                id="expectedClose"
                type="date"
                {...register("expectedClose")}
              />
            </FormField>
            <FormField id="portId" label="Port" error={errors.portId?.message}>
              <select
                id="portId"
                className={cn(SELECT_CLASS)}
                {...register("portId")}
              >
                <option value="">Unassigned</option>
                {ports.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField
            id="captainId"
            label="Owner (captain)"
            error={errors.captainId?.message}
          >
            <select
              id="captainId"
              className={cn(SELECT_CLASS)}
              {...register("captainId")}
            >
              <option value="">Unassigned</option>
              {captains.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField id="notes" label="Notes" error={errors.notes?.message}>
            <Textarea
              id="notes"
              placeholder="Anything worth logging about this voyage…"
              {...register("notes")}
            />
          </FormField>

          {formError ? (
            <p role="alert" className="text-sm font-medium text-signal-red">
              {formError}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Belay
            </Button>
            <Button type="submit" variant="brass" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {editing ? "Save changes" : "Chart voyage"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function blankValues(
  defaultStage?: string,
  defaultPortId?: string,
): VoyageFormValues {
  return {
    name: "",
    stage: (defaultStage ?? "CHARTED") as VoyageFormValues["stage"],
    value: 0,
    expectedClose: "",
    portId: defaultPortId ?? "",
    captainId: "",
    notes: "",
  };
}

function toValues(v: VoyageDialogData): VoyageFormValues {
  return {
    name: v.name,
    stage: v.stage as VoyageFormValues["stage"],
    value: v.value,
    expectedClose: v.expectedClose ?? "",
    portId: v.portId ?? "",
    captainId: v.captainId ?? "",
    notes: v.notes ?? "",
  };
}
