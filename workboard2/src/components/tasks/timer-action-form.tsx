"use client";

import { useActionState } from "react";
import type { TimerFormState } from "@/app/(app)/tasks/actions";

const initialState: TimerFormState = { error: null };

/**
 * A single timer button (start/switch/pause) wired through useActionState
 * so a rejected RPC call (wrong task status, not clocked in, already has a
 * timer running elsewhere, ...) shows its real message instead of the
 * button silently doing nothing — see the comment on TimerFormState in
 * ../../app/(app)/tasks/actions.ts for why this can't be a plain
 * <form action={...}>.
 *
 * Renders as a single flex child (a column) so it drops into an existing
 * `flex items-center justify-between` row without disturbing that layout
 * whether or not an error is currently showing.
 */
export function TimerActionForm({
  action,
  taskId,
  buttonLabel,
  pendingLabel,
  buttonClassName,
}: {
  action: (state: TimerFormState, formData: FormData) => Promise<TimerFormState>;
  taskId: string;
  buttonLabel: string;
  pendingLabel?: string;
  buttonClassName: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="task_id" value={taskId} />
        <button type="submit" disabled={pending} className={`${buttonClassName} disabled:opacity-60`}>
          {pending ? (pendingLabel ?? "กำลังดำเนินการ...") : buttonLabel}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="max-w-[16rem] text-right text-xs text-red-600">
          {state.error}
        </p>
      )}
    </div>
  );
}
