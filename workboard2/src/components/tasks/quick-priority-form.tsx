"use client";

import { useActionState } from "react";
import {
  type TaskEditFormState,
  updateTaskPriorityAction,
} from "@/app/(app)/tasks/actions";

const initialState: TaskEditFormState = { error: null, success: null };

export function QuickPriorityForm({
  taskId,
  isImportant,
  isUrgent,
}: {
  taskId: string;
  isImportant: boolean;
  isUrgent: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateTaskPriorityAction,
    initialState,
  );

  return (
    <form action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="task_id" value={taskId} />
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="is_important"
            defaultChecked={isImportant}
          />
          สำคัญ
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="is_urgent"
            defaultChecked={isUrgent}
          />
          เร่งด่วน
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 font-medium disabled:opacity-60"
        >
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-[11px] text-red-600">
          {state.error}
        </p>
      )}
      {!state.error && state.success && (
        <p role="status" className="text-[11px] text-emerald-700">
          {state.success}
        </p>
      )}
    </form>
  );
}
