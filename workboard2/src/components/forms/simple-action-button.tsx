"use client";

import { useActionState } from "react";
import type { PlannerFormState } from "@/components/planner/action-form";

const initialState: PlannerFormState = { error: null, success: null };

export function SimpleActionButton({
  action,
  hiddenFields,
  label,
  pendingLabel = "กำลังบันทึก...",
  className = "rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-60",
  confirmMessage,
}: {
  action: (
    state: PlannerFormState,
    formData: FormData,
  ) => Promise<PlannerFormState>;
  hiddenFields?: Record<string, string>;
  label: string;
  pendingLabel?: string;
  className?: string;
  confirmMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      className="inline-flex flex-col items-start gap-1"
    >
      {Object.entries(hiddenFields ?? {}).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <button type="submit" disabled={pending} className={className}>
        {pending ? pendingLabel : label}
      </button>
      {state.error && (
        <p role="alert" className="text-[11px] text-red-600">
          {state.error}
        </p>
      )}
      {state.success && !state.error && (
        <p role="status" className="text-[11px] text-emerald-700">
          {state.success}
        </p>
      )}
    </form>
  );
}
