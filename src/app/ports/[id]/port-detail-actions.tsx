"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { deletePort } from "../actions";
import { PortDialog, type PortDialogData } from "../port-dialog";

/** Edit / delete controls for a single port's detail page. */
export function PortDetailActions({ port }: { port: PortDialogData }) {
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

      <PortDialog open={editOpen} onOpenChange={setEditOpen} port={port} />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Scuttle this port?"
        description={
          <>
            <strong>{port.name}</strong> will be removed. Its captains and
            voyages are kept but cut loose from this port.
          </>
        }
        onConfirm={() => deletePort(port.id)}
        redirectTo="/ports"
      />
    </div>
  );
}
