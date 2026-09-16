"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export interface HeadTaskFormState {
  error: string | null;
  success?: string | null;
}

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function updateTaskPeopleAction(
  _state: HeadTaskFormState,
  formData: FormData,
): Promise<HeadTaskFormState> {
  const taskId = value(formData, "task_id");
  const assigneePersonId = value(formData, "assignee_person_id");
  const reviewerPersonId = value(formData, "reviewer_person_id") || null;
  const approverPersonId = value(formData, "approver_person_id") || null;

  if (!taskId || !assigneePersonId) {
    return { error: "กรุณาเลือกงานและผู้รับผิดชอบ" };
  }

  const user = await getCurrentUser();
  if (!user) return { error: "ต้องเข้าสู่ระบบ" };

  const supabase = await createClient();
  const { data: task, error } = await supabase.rpc("manage_task_people", {
    p_task_id: taskId,
    p_assignee_person_id: assigneePersonId,
    p_reviewer_person_id: reviewerPersonId,
    p_approver_person_id: approverPersonId,
  });

  if (error) return { error: error.message };

  revalidatePath("/head");
  revalidatePath("/my-work");
  revalidatePath("/member");
  revalidatePath("/overview");
  revalidatePath(`/tasks/${taskId}`);
  if (task?.project_id) revalidatePath(`/projects/${task.project_id}`);

  return { error: null, success: "อัปเดตผู้รับผิดชอบและสายตรวจงานแล้ว" };
}
