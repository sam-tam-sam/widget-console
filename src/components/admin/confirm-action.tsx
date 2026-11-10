"use client";

import { useId, useRef, useState, type ReactNode, type Ref } from "react";
import { useFormStatus } from "react-dom";
import type { FormResult } from "@/app/(admin)/admin/actions";
import { AdminForm, FormMessage } from "@/components/admin/form";
import { Button } from "@/components/ui/button";

function CancelButton({ buttonRef, close }: { buttonRef: Ref<HTMLButtonElement>; close: () => void }) {
  const { pending } = useFormStatus();
  return <Button ref={buttonRef} type="button" variant="outline" onClick={close} disabled={pending}>Cancel</Button>;
}

type ConfirmActionProps = {
  action: (state: FormResult, data: FormData) => Promise<FormResult>;
  label: string;
  children: ReactNode;
  confirmation?: { title: string; description: ReactNode; label: string };
  destructive?: boolean;
  icon?: ReactNode;
};

export function ConfirmAction({ action, label, children, confirmation, destructive, icon }: ConfirmActionProps) {
  const [result, setResult] = useState<FormResult>({});
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const descriptionId = useId();

  function open() {
    setResult({});
    dialog.current?.showModal();
    cancel.current?.focus();
  }

  async function submit(state: FormResult, data: FormData) {
    const outcome = await action(state, data);
    if (outcome.error) return outcome;
    setResult(outcome);
    dialog.current?.close();
    return {};
  }

  return (
    <>
      {confirmation ? (
        <>
          <Button ref={trigger} type="button" variant={destructive ? "destructive" : "default"} onClick={open}>
            {icon}{label}
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
            <h2 id={headingId}>{confirmation.title}</h2>
            <p id={descriptionId}>{confirmation.description}</p>
            <AdminForm action={submit} label={confirmation.label} variant="destructive" className="console-dialog-actions">
              {children}
              <CancelButton buttonRef={cancel} close={() => dialog.current?.close()} />
            </AdminForm>
          </dialog>
        </>
      ) : (
        <AdminForm action={submit} label={label} className="console-form">{children}</AdminForm>
      )}
      <FormMessage state={result} />
    </>
  );
}
