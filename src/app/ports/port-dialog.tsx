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
import { portSchema, type PortFormValues } from "@/lib/ports";
import { createPort, updatePort } from "./actions";

export interface PortDialogData {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  location: string | null;
  notes: string | null;
}

export function PortDialog({
  open,
  onOpenChange,
  port,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When present the dialog edits this port; otherwise it creates a new one. */
  port?: PortDialogData | null;
}) {
  const router = useRouter();
  const editing = Boolean(port);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PortFormValues>({
    resolver: zodResolver(portSchema),
    defaultValues: blankValues(),
  });

  // Reset the form whenever we (re)open or switch which port we're editing.
  React.useEffect(() => {
    if (open) {
      reset(port ? toValues(port) : blankValues());
      setFormError(null);
    }
  }, [open, port, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const parsed = portSchema.parse(values);
    const result = port
      ? await updatePort(port.id, parsed)
      : await createPort(parsed);

    if (result.ok) {
      onOpenChange(false);
      router.refresh();
      return;
    }
    if (result.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        if (messages?.[0]) {
          setError(field as keyof PortFormValues, { message: messages[0] });
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
            {editing ? "Edit port" : "Chart a new port"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this company's details."
              : "Add a company your fleet trades with."}
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
              placeholder="Meridian Shipping Co."
              aria-invalid={Boolean(errors.name)}
              {...register("name")}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="industry"
              label="Industry"
              error={errors.industry?.message}
            >
              <Input
                id="industry"
                placeholder="Logistics"
                {...register("industry")}
              />
            </FormField>
            <FormField
              id="location"
              label="Home waters"
              error={errors.location?.message}
            >
              <Input
                id="location"
                placeholder="Bristol"
                {...register("location")}
              />
            </FormField>
          </div>

          <FormField
            id="website"
            label="Website"
            error={errors.website?.message}
          >
            <Input
              id="website"
              placeholder="https://example.com"
              {...register("website")}
            />
          </FormField>

          <FormField id="notes" label="Notes" error={errors.notes?.message}>
            <Textarea
              id="notes"
              placeholder="Anything worth logging about this port…"
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
              {editing ? "Save changes" : "Chart port"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function blankValues(): PortFormValues {
  return { name: "", industry: "", website: "", location: "", notes: "" };
}

function toValues(p: PortDialogData): PortFormValues {
  return {
    name: p.name,
    industry: p.industry ?? "",
    website: p.website ?? "",
    location: p.location ?? "",
    notes: p.notes ?? "",
  };
}
