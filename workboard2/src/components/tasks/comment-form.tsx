"use client";

import { useActionState } from "react";
import {
  addCommentAction,
  type CommentFormState,
} from "@/app/(app)/tasks/actions";

const initialState: CommentFormState = { error: null, success: null };

export function TaskCommentForm({ taskId }: { taskId: string }) {
  const [state, formAction, pending] = useActionState(
    addCommentAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="mt-4 space-y-2 border-t border-slate-100 pt-4"
    >
      <input type="hidden" name="task_id" value={taskId} />
      <textarea
        name="body"
        placeholder="เขียนความคิดเห็นหรือคำถาม"
        required
        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        rows={2}
      />
      <label className="flex items-center gap-2 text-xs text-slate-500">
        <input type="checkbox" name="is_question" />
        เป็นคำถาม
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
      >
        {pending ? "กำลังส่ง..." : "ส่งความคิดเห็น"}
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
