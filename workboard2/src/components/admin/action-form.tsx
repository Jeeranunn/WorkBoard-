"use client";

import { useActionState, type ReactNode } from "react";
import type { AdminFormState } from "@/app/(app)/admin/actions";

const initialState: AdminFormState = { error: null, success: null };

export function AdminActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "กำลังบันทึก...",
  className = "space-y-2",
  buttonClassName = "rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-60",
}: {
  action: (
    state: AdminFormState,
    formData: FormData,
  ) => Promise<AdminFormState>;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={className}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      <button type="submit" disabled={pending} className={buttonClassName}>
        {pending ? pendingLabel : submitLabel}
      </button>
      {state.error && (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      )}
      {!state.error && state.success && (
        <p role="status" className="text-xs text-emerald-700">
          {state.success}
        </p>
      )}
    </form>
  );
}
