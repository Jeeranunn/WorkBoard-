"use client";

import { useActionState } from "react";
import {
  cancelTaskAction,
  type TaskEditFormState,
  updateManualTaskDetailsAction,
  updateTaskPriorityAction,
} from "@/app/(app)/tasks/actions";

const initialState: TaskEditFormState = { error: null, success: null };

function Feedback({ state }: { state: TaskEditFormState }) {
  return (
    <>
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
    </>
  );
}

export function TaskEditPanel({
  task,
  canEditPriority,
  canEditDetails,
  canCancel,
}: {
  task: {
    id: string;
    title: string;
    description: string | null;
    deadlineLocal: string;
    estimatedHours: number | null;
    isImportant: boolean;
    isUrgent: boolean;
    source: string | null;
  };
  canEditPriority: boolean;
  canEditDetails: boolean;
  canCancel: boolean;
}) {
  const [priorityState, priorityAction, priorityPending] = useActionState(
    updateTaskPriorityAction,
    initialState,
  );
  const [detailsState, detailsAction, detailsPending] = useActionState(
    updateManualTaskDetailsAction,
    initialState,
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelTaskAction,
    initialState,
  );

  if (!canEditPriority && !canEditDetails && !canCancel) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold">แก้ไขงาน</h2>
      <p className="mt-1 text-xs text-slate-500">
        Priority เปลี่ยนได้โดยผู้รับผิดชอบเอง ส่วนรายละเอียดแก้ได้สำหรับงานที่เพิ่มเอง
      </p>

      {canEditPriority && (
        <form action={priorityAction} className="mt-4 space-y-3 rounded-lg bg-slate-50 p-3">
          <input type="hidden" name="task_id" value={task.id} />
          <div className="text-xs font-medium text-slate-500">Priority ของงาน</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
              <input
                type="checkbox"
                name="is_important"
                defaultChecked={task.isImportant}
              />
              สำคัญ
            </label>
            <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
              <input
                type="checkbox"
                name="is_urgent"
                defaultChecked={task.isUrgent}
              />
              เร่งด่วน
            </label>
          </div>
          <div className="text-[11px] text-slate-400">
            สำคัญ+เร่งด่วน=P1 · สำคัญ=P2 · เร่งด่วน=P3 · ไม่ทั้งคู่=P4
          </div>
          <button
            type="submit"
            disabled={priorityPending}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {priorityPending ? "กำลังบันทึก..." : "บันทึก Priority"}
          </button>
          <Feedback state={priorityState} />
        </form>
      )}

      {canEditDetails && (
        <details className="mt-4 rounded-lg border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-medium">
            แก้รายละเอียดงานที่เพิ่มเอง
          </summary>
          <form action={detailsAction} className="mt-3 space-y-3">
            <input type="hidden" name="task_id" value={task.id} />
            <input
              name="title"
              required
              defaultValue={task.title}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <textarea
              name="description"
              rows={3}
              defaultValue={task.description ?? ""}
              placeholder="รายละเอียดงาน"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs">
                <span className="font-medium text-slate-500">กำหนดส่ง</span>
                <input
                  type="datetime-local"
                  name="deadline"
                  defaultValue={task.deadlineLocal}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs">
                <span className="font-medium text-slate-500">ชั่วโมงโดยประมาณ</span>
                <input
                  type="number"
                  name="estimated_hours"
                  min="0.25"
                  step="0.25"
                  defaultValue={task.estimatedHours ?? ""}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_important"
                  defaultChecked={task.isImportant}
                />
                สำคัญ
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_urgent"
                  defaultChecked={task.isUrgent}
                />
                เร่งด่วน
              </label>
            </div>
            <button
              type="submit"
              disabled={detailsPending}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {detailsPending ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
            </button>
            <Feedback state={detailsState} />
          </form>
        </details>
      )}

      {canCancel && (
        <form action={cancelAction} className="mt-4 border-t border-slate-100 pt-4">
          <input type="hidden" name="task_id" value={task.id} />
          <p className="mb-2 text-xs text-slate-500">
            นำงานออกจากงานที่ใช้งาน แต่ยังเก็บประวัติ เวลา และการส่งงานไว้ตรวจสอบย้อนหลัง
          </p>
          <button
            type="submit"
            disabled={cancelPending}
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 disabled:opacity-60"
          >
            {cancelPending ? "กำลังนำออก..." : "ลบออกจากงานที่ใช้งาน"}
          </button>
          <Feedback state={cancelState} />
        </form>
      )}
    </section>
  );
}
