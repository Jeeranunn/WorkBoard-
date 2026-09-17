"use client";

import { PlannerActionForm } from "@/components/planner/action-form";
import { submitLearningReflectionAction } from "@/app/(app)/learning/actions";
import { bangkokTodayKey } from "@/lib/date-time";

export function LearningReflectionForm() {
  return (
    <PlannerActionForm
      action={submitLearningReflectionAction}
      submitLabel="บันทึก"
      className="mt-3 space-y-3"
    >
      <div>
        <label className="block text-xs font-medium text-slate-600">
          ชื่อการประชุม/กิจกรรม
        </label>
        <input
          type="text"
          name="meeting_name"
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">วันที่</label>
        <input
          type="date"
          name="meeting_date"
          required
          defaultValue={bangkokTodayKey()}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">
          ได้เรียนรู้อะไรบ้าง
        </label>
        <textarea
          name="note"
          required
          rows={3}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
    </PlannerActionForm>
  );
}
