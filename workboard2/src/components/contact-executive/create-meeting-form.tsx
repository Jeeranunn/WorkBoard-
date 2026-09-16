"use client";

import { PlannerActionForm } from "@/components/planner/action-form";
import { createMeetingRequestAction } from "@/app/(app)/contact-executive/actions";

export function CreateMeetingForm({
  executives,
}: {
  executives: { id: string; fullName: string }[];
}) {
  return (
    <PlannerActionForm
      action={createMeetingRequestAction}
      submitLabel="ส่งคำขอนัดหมาย"
      className="mt-3 space-y-3"
    >
      <div>
        <label className="block text-xs font-medium text-slate-600">
          ส่งถึง
        </label>
        <select
          name="recipient_person_id"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          defaultValue=""
        >
          <option value="">ผู้บริหารทุกคน</option>
          {executives.map((exec) => (
            <option key={exec.id} value={exec.id}>
              {exec.fullName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">หัวข้อ</label>
        <input
          type="text"
          name="topic"
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600">
            วันเวลาที่ต้องการ
          </label>
          <input
            type="datetime-local"
            name="requested_start"
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">
            ระยะเวลา (นาที)
          </label>
          <input
            type="number"
            name="duration_minutes"
            min={1}
            defaultValue={30}
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">
          สถานที่ (ถ้ามี)
        </label>
        <input
          type="text"
          name="location"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
    </PlannerActionForm>
  );
}
