"use client";

import { Trash2 } from "lucide-react";
import { deleteInstanceAction } from "@/app/(admin)/admin/actions";
import { ConfirmAction } from "@/components/admin/confirm-action";

export function DeleteWidget({ id, name, linkCount }: { id: string; name: string; linkCount: number }) {
  return (
    <ConfirmAction
      action={deleteInstanceAction}
      label="Delete widget"
      destructive
      icon={<Trash2 aria-hidden="true" />}
      confirmation={{
        title: "Delete widget?",
        label: "Delete widget",
        description: <>
          <strong>{name}</strong> will be permanently deleted.
          {linkCount === 1 && " Its embed link will stop working."}
          {linkCount > 1 && ` All ${linkCount} embed links will stop working.`}
        </>,
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="confirmed" value="yes" />
    </ConfirmAction>
  );
}
