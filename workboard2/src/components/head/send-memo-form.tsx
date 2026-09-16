"use client";

import { PlannerActionForm } from "@/components/planner/action-form";
import { sendManagementMemoAction } from "@/app/(app)/head/memos/actions";

export function SendMemoForm() {
  return (
    <PlannerActionForm
      action={sendManagementMemoAction}
      submitLabel="ส่งบันทึกข้อความ"
      className="mt-3 space-y-3"
    >
      <div>
        <label className="block text-xs font-medium text-slate-600">หัวข้อ</label>
        <input
          type="text"
          name="subject"
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">
          รายละเอียด (ถ้ามี)
        </label>
        <textarea
          name="body"
          rows={3}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">
          ลิงก์แนบ (ถ้ามี)
        </label>
        <input
          type="url"
          name="link"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
    </PlannerActionForm>
  );
}
