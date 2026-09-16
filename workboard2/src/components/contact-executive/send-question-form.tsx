"use client";

import { PlannerActionForm } from "@/components/planner/action-form";
import { sendQuestionAction } from "@/app/(app)/contact-executive/actions";

export function SendQuestionForm({
  executives,
}: {
  executives: { id: string; fullName: string }[];
}) {
  return (
    <PlannerActionForm
      action={sendQuestionAction}
      submitLabel="ส่งคำถาม"
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
        <label className="block text-xs font-medium text-slate-600">คำถาม</label>
        <textarea
          name="question"
          required
          rows={3}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
    </PlannerActionForm>
  );
}
