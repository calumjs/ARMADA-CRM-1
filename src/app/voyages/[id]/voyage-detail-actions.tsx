"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { deleteVoyage } from "../actions";
import {
  VoyageDialog,
  type VoyageDialogData,
  type VoyageOption,
} from "../voyage-dialog";

/** Edit / delete controls for a single voyage's detail page. */
export function VoyageDetailActions({
  voyage,
  ports,
  captains,
}: {
  voyage: VoyageDialogData;
  ports: VoyageOption[];
  captains: VoyageOption[];
}) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={() => setEditOpen(true)}>
        <Pencil className="h-4 w-4" />
        Edit
      </Button>
      <Button
        variant="ghost"
        className="text-signal-red hover:text-signal-red"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </Button>

      <VoyageDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        voyage={voyage}
        ports={ports}
        captains={captains}
      />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Scuttle this voyage?"
        description={
          <>
            <strong>{voyage.name}</strong> will be removed. This can&apos;t be
            undone.
          </>
        }
        onConfirm={() => deleteVoyage(voyage.id)}
        redirectTo="/voyages"
      />
    </div>
  );
}
