"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import type { PlannerFormState } from "@/components/planner/action-form";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function submitLearningReflectionAction(
  _state: PlannerFormState,
  formData: FormData,
): Promise<PlannerFormState> {
  const meetingName = str(formData, "meeting_name");
  const meetingDate = str(formData, "meeting_date");
  const note = str(formData, "note");

  if (!meetingName) return { error: "กรุณาระบุชื่อการประชุม/กิจกรรม" };
  if (!meetingDate) return { error: "กรุณาระบุวันที่" };
  if (!note) return { error: "กรุณาสรุปสิ่งที่ได้เรียนรู้" };

  const user = await getCurrentUser();
  if (!user) return { error: "ต้องเข้าสู่ระบบ" };

  const supabase = await createClient();
  const { error } = await supabase.from("learning_reflections").insert({
    person_id: user.personId,
    meeting_name: meetingName,
    meeting_date: meetingDate,
    note,
  });

  if (error) return { error: error.message };

  revalidatePath("/learning");
  return { error: null, success: "บันทึกการเรียนรู้แล้ว" };
}
