"use client";

import { useActionState, type ReactNode } from "react";

export interface PlannerFormState {
  error: string | null;
  success?: string | null;
}

const initialState: PlannerFormState = { error: null, success: null };

export function PlannerActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "กำลังบันทึก...",
  className = "space-y-3",
  buttonClassName = "rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60",
}: {
  action: (
    state: PlannerFormState,
    formData: FormData,
  ) => Promise<PlannerFormState>;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={className}>
      {children}
      <button type="submit" disabled={pending} className={buttonClassName}>
        {pending ? pendingLabel : submitLabel}
      </button>
      {state.error && (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      )}
      {state.success && !state.error && (
        <p role="status" className="text-xs text-emerald-700">
          {state.success}
        </p>
      )}
    </form>
  );
}
