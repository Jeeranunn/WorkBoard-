"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PlannerFormState } from "@/components/planner/action-form";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalStr(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value === "" ? null : value;
}

export async function sendManagementMemoAction(
  _state: PlannerFormState,
  formData: FormData,
): Promise<PlannerFormState> {
  const subject = str(formData, "subject");
  if (!subject) return { error: "กรุณาระบุหัวข้อ" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("send_management_memo", {
    p_subject: subject,
    p_body: optionalStr(formData, "body"),
    p_link: optionalStr(formData, "link"),
  });

  if (error) return { error: error.message };

  revalidatePath("/head/memos");
  revalidatePath("/executive/inbox");
  return { error: null, success: "ส่งบันทึกข้อความแล้ว" };
}
