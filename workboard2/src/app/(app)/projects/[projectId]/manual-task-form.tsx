"use client";

import { useActionState } from "react";
import {
  createManualTaskAction,
  type ManualTaskFormState,
} from "../actions";

const initialState: ManualTaskFormState = { error: null, success: null };

export function ManualTaskForm({
  projectId,
  workstreams,
  people,
  canAssignOthers,
}: {
  projectId: string;
  workstreams: { id: string; name: string }[];
  people: { id: string; name: string }[];
  canAssignOthers: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    createManualTaskAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="project_id" value={projectId} />

      <div>
        <label className="text-xs font-medium text-slate-500">ชื่องาน</label>
        <input
          name="title"
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="เช่น ประสานวิทยากร / เตรียมเอกสาร / ลงพื้นที่"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500">รายละเอียด</label>
        <textarea
          name="description"
          rows={3}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs">
          <span className="font-medium text-slate-500">กลุ่มงาน (ไม่บังคับ)</span>
          <select
            name="workstream_id"
            defaultValue=""
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">ไม่เข้ากลุ่มงาน</option>
            {workstreams.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs">
          <span className="font-medium text-slate-500">ผู้รับผิดชอบ</span>
          {canAssignOthers ? (
            <select
              name="assignee_person_id"
              defaultValue=""
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">ตัวฉัน / ค่าเริ่มต้น</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              งานของฉัน
            </div>
          )}
        </label>
      </div>

      {canAssignOthers && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs">
            <span className="font-medium text-slate-500">ผู้ตรวจ (ไม่บังคับ)</span>
            <select
              name="reviewer_person_id"
              defaultValue=""
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">ยังไม่กำหนด</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs">
            <span className="font-medium text-slate-500">ผู้อนุมัติ (ไม่บังคับ)</span>
            <select
              name="approver_person_id"
              defaultValue=""
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">ยังไม่กำหนด</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs">
          <span className="font-medium text-slate-500">กำหนดส่ง</span>
          <input
            type="datetime-local"
            name="deadline"
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
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is_important" defaultChecked />
          สำคัญ
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is_urgent" />
          เร่งด่วน
        </label>
      </div>

      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      {!state.error && state.success && (
        <p className="text-xs text-emerald-700">{state.success}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "กำลังเพิ่มงาน..." : "เพิ่มงานเอง"}
      </button>
    </form>
  );
}
