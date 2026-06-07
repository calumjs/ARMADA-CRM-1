"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2, UserRound } from "lucide-react";

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
import { captainSchema, type CaptainFormValues } from "@/lib/ports";
import { createCaptain, updateCaptain } from "@/app/ports/actions";

export interface CaptainDialogData {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  notes: string | null;
  portId: string | null;
}

export interface PortOption {
  id: string;
  name: string;
}

export function CaptainDialog({
  open,
  onOpenChange,
  captain,
  ports,
  defaultPortId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  captain?: CaptainDialogData | null;
  ports: PortOption[];
  defaultPortId?: string;
}) {
  const router = useRouter();
  const editing = Boolean(captain);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CaptainFormValues>({
    resolver: zodResolver(captainSchema),
    defaultValues: blankValues(defaultPortId),
  });

  React.useEffect(() => {
    if (open) {
      reset(captain ? toValues(captain) : blankValues(defaultPortId));
      setFormError(null);
    }
  }, [open, captain, defaultPortId, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const parsed = captainSchema.parse(values);
    const result = captain
      ? await updateCaptain(captain.id, parsed)
      : await createCaptain(parsed);

    if (result.ok) {
      onOpenChange(false);
      router.refresh();
      return;
    }
    if (result.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        if (messages?.[0]) {
          setError(field as keyof CaptainFormValues, { message: messages[0] });
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
            <UserRound className="h-5 w-5 text-brass" />
            {editing ? "Edit captain" : "Sign on a captain"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this contact's details."
              : "Add a contact and link them to a port."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="firstName"
              label="First name"
              required
              error={errors.firstName?.message}
            >
              <Input
                id="firstName"
                placeholder="Ada"
                aria-invalid={Boolean(errors.firstName)}
                {...register("firstName")}
              />
            </FormField>
            <FormField
              id="lastName"
              label="Last name"
              required
              error={errors.lastName?.message}
            >
              <Input
                id="lastName"
                placeholder="Vance"
                aria-invalid={Boolean(errors.lastName)}
                {...register("lastName")}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="email" label="Email" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                placeholder="ada.vance@example.com"
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
            </FormField>
            <FormField id="phone" label="Phone" error={errors.phone?.message}>
              <Input
                id="phone"
                placeholder="+44 7700 900000"
                {...register("phone")}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="title" label="Role" error={errors.title?.message}>
              <Input
                id="title"
                placeholder="Procurement Lead"
                {...register("title")}
              />
            </FormField>
            <FormField id="portId" label="Port" error={errors.portId?.message}>
              <select
                id="portId"
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                )}
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

          <FormField id="notes" label="Notes" error={errors.notes?.message}>
            <Textarea
              id="notes"
              placeholder="Anything worth logging about this captain…"
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
              {editing ? "Save changes" : "Sign on"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function blankValues(defaultPortId?: string): CaptainFormValues {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    title: "",
    notes: "",
    portId: defaultPortId ?? "",
  };
}

function toValues(c: CaptainDialogData): CaptainFormValues {
  return {
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email ?? "",
    phone: c.phone ?? "",
    title: c.title ?? "",
    notes: c.notes ?? "",
    portId: c.portId ?? "",
  };
}
