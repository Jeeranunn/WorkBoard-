"use client";

import { useActionState, type ReactNode } from "react";
import type { WorkflowFormState } from "@/app/(app)/tasks/actions";

const initialState: WorkflowFormState = { error: null, success: null };

export function WorkflowActionForm({
  action,
  taskId,
  children,
  className = "",
}: {
  action: (
    state: WorkflowFormState,
    formData: FormData,
  ) => Promise<WorkflowFormState>;
  taskId: string;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={className} aria-busy={pending}>
      <input type="hidden" name="task_id" value={taskId} />
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state.error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
