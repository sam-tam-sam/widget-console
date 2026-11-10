"use client";

import { useId, useRef, type Ref } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import { deleteInstanceAction } from "@/app/(admin)/admin/actions";
import { AdminForm } from "@/components/admin/form";
import { Button } from "@/components/ui/button";

function CancelButton({ buttonRef, close }: { buttonRef: Ref<HTMLButtonElement>; close: () => void }) {
  const { pending } = useFormStatus();
  return <Button ref={buttonRef} type="button" variant="outline" onClick={close} disabled={pending}>Cancel</Button>;
}

export function DeleteWidget({ id, name, linkCount }: { id: string; name: string; linkCount: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const descriptionId = useId();

  function open() {
    dialog.current?.showModal();
    cancel.current?.focus();
  }

  return (
    <>
      <Button ref={trigger} type="button" variant="destructive" onClick={open}>
        <Trash2 aria-hidden="true" />Delete widget
      </Button>
      <dialog
        ref={dialog}
        className="console-confirm-dialog"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
        onClose={() => trigger.current?.focus()}
        onCancel={(event) => {
          if (event.currentTarget.querySelector('form[aria-busy="true"]')) event.preventDefault();
        }}
      >
        <h2 id={headingId}>Delete widget?</h2>
        <p id={descriptionId}>
          <strong>{name}</strong> will be permanently deleted.
          {linkCount > 0 && ` All ${linkCount} embed ${linkCount === 1 ? "link" : "links"} will stop working.`}
        </p>
        <AdminForm action={deleteInstanceAction} label="Delete widget" variant="destructive" className="console-dialog-actions">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="confirmed" value="yes" />
          <CancelButton buttonRef={cancel} close={() => dialog.current?.close()} />
        </AdminForm>
      </dialog>
    </>
  );
}
