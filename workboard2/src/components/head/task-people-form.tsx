"use client";

import { useActionState } from "react";
import {
  updateTaskPeopleAction,
  type HeadTaskFormState,
} from "@/app/(app)/head/actions";

const initialState: HeadTaskFormState = { error: null, success: null };

interface PersonOption {
  id: string;
  name: string;
}

export function TaskPeopleForm({
  taskId,
  people,
  assigneePersonId,
  reviewerPersonId,
  approverPersonId,
}: {
  taskId: string;
  people: PersonOption[];
  assigneePersonId: string;
  reviewerPersonId: string | null;
  approverPersonId: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    updateTaskPeopleAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <input type="hidden" name="task_id" value={taskId} />

      <div className="grid gap-2 md:grid-cols-3">
        <label className="space-y-1 text-xs">
          <span className="text-slate-500">ผู้รับผิดชอบ</span>
          <select
            name="assignee_person_id"
            defaultValue={assigneePersonId}
            required
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs">
          <span className="text-slate-500">ผู้ตรวจ</span>
          <select
            name="reviewer_person_id"
            defaultValue={reviewerPersonId ?? ""}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">ไม่มี</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs">
          <span className="text-slate-500">ผู้อนุมัติ</span>
          <select
            name="approver_person_id"
            defaultValue={approverPersonId ?? ""}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">ไม่มี</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs">
          {state.error && <span className="text-red-600">{state.error}</span>}
          {!state.error && state.success && (
            <span className="text-emerald-700">{state.success}</span>
          )}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {pending ? "กำลังบันทึก..." : "บันทึกผู้เกี่ยวข้อง"}
        </button>
      </div>
    </form>
  );
}
