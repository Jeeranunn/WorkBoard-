"use client";

import { useActionState } from "react";
import {
  createPrioritySuggestionAction,
  type ExecutiveSuggestionState,
} from "@/app/(app)/executive/actions";

const initialState: ExecutiveSuggestionState = {
  error: null,
  success: null,
};

export function PrioritySuggestionForm({
  tasks,
}: {
  tasks: { id: string; title: string; projectName: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    createPrioritySuggestionAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <label className="block text-xs">
        <span className="font-medium text-slate-500">งาน</span>
        <select
          name="task_id"
          required
          defaultValue=""
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">เลือกงาน</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title} — {task.projectName}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs">
        <span className="font-medium text-slate-500">เสนอ Priority</span>
        <select
          name="priority"
          required
          defaultValue="P1"
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="P1">P1 — สำคัญและเร่งด่วน</option>
          <option value="P2">P2 — สำคัญแต่ไม่เร่งด่วน</option>
          <option value="P3">P3 — ไม่สำคัญแต่เร่งด่วน</option>
          <option value="P4">P4 — ไม่สำคัญและไม่เร่งด่วน</option>
        </select>
      </label>

      <label className="block text-xs">
        <span className="font-medium text-slate-500">เหตุผล</span>
        <textarea
          name="reason"
          rows={3}
          placeholder="อธิบายเหตุผลให้ผู้รับผิดชอบใช้ประกอบการตัดสินใจ"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      {!state.error && state.success && (
        <p className="text-xs text-emerald-700">{state.success}</p>
      )}

      <button
        type="submit"
        disabled={pending || tasks.length === 0}
        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "กำลังส่ง..." : "ส่งคำแนะนำ"}
      </button>
    </form>
  );
}
