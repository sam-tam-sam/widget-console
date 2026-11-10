"use client";

import { useActionState, useId, type ReactNode } from "react";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FormResult } from "@/app/(admin)/admin/actions";

type AdminFormProps = {
  action: (state: FormResult, data: FormData) => Promise<FormResult>;
  children: ReactNode;
  label: string;
  variant?: "default" | "outline" | "secondary" | "destructive";
  disabled?: boolean;
  className?: string;
};

export function FormMessage({ state, id }: { state: FormResult; id?: string }) {
  if (!state.message) return null;

  return (
    <p id={id} role={state.error ? "alert" : "status"} className="console-message" data-error={state.error || undefined}>
      {state.error ? <CircleAlert size={16} aria-hidden="true" /> : <CircleCheck size={16} aria-hidden="true" />}
      {state.message}
    </p>
  );
}

export function AdminForm({ action, children, label, variant, disabled, className }: AdminFormProps) {
  const [state, dispatch, pending] = useActionState(action, {});
  const statusId = useId();

  return (
    <form action={dispatch} className={className} aria-busy={pending || undefined} aria-describedby={state.message ? statusId : undefined}>
      {children}
      <Button type="submit" variant={variant} disabled={disabled || pending}>
        {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        {label}
      </Button>
      <FormMessage state={state} id={statusId} />
    </form>
  );
}
