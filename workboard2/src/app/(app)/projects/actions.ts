"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { bangkokLocalDateTimeToIso } from "@/lib/date-time";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalStr(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value === "" ? null : value;
}

export async function createProjectAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("ต้องเข้าสู่ระบบ");

  const organizationId = str(formData, "organization_id");
  const name = str(formData, "name");
  if (!organizationId || !name) return;

  const supabase = await createClient();
  const playbookId = optionalStr(formData, "playbook_id");

  const { data, error } = await supabase.rpc("create_project_with_optional_playbook", {
    p_organization_id: organizationId,
    p_name: name,
    p_description: optionalStr(formData, "description"),
    p_start_date: optionalStr(formData, "start_date"),
    p_target_date: optionalStr(formData, "target_date"),
    p_playbook_id: playbookId,
  });
  if (error) throw new Error(error.message);

  redirect(`/projects/${data.id}`);
}

export async function applyPlaybookAction(formData: FormData) {
  const projectId = str(formData, "project_id");
  const playbookId = str(formData, "playbook_id");
  if (!projectId || !playbookId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_playbook_to_project", {
    p_project_id: projectId,
    p_playbook_id: playbookId,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/projects/${projectId}`);
}


export interface ManualTaskFormState {
  error: string | null;
  success?: string | null;
}

export async function createManualTaskAction(
  _state: ManualTaskFormState,
  formData: FormData,
): Promise<ManualTaskFormState> {
  const projectId = str(formData, "project_id");
  const title = str(formData, "title");
  const description = optionalStr(formData, "description");
  const workstreamId = optionalStr(formData, "workstream_id");
  const assigneePersonId = optionalStr(formData, "assignee_person_id");
  const reviewerPersonId = optionalStr(formData, "reviewer_person_id");
  const approverPersonId = optionalStr(formData, "approver_person_id");
  const deadlineRaw = optionalStr(formData, "deadline");
  const estimatedHoursRaw = optionalStr(formData, "estimated_hours");

  if (!projectId || !title) {
    return { error: "กรุณาใส่ชื่องาน" };
  }

  const estimatedHours = estimatedHoursRaw ? Number(estimatedHoursRaw) : null;
  if (
    estimatedHours !== null &&
    (!Number.isFinite(estimatedHours) || estimatedHours <= 0)
  ) {
    return { error: "ชั่วโมงโดยประมาณต้องมากกว่า 0" };
  }

  let deadline: string | null = null;
  try {
    deadline = deadlineRaw ? bangkokLocalDateTimeToIso(deadlineRaw) : null;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "วันเวลาไม่ถูกต้อง",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_manual_task", {
    p_project_id: projectId,
    p_title: title,
    p_description: description,
    p_workstream_id: workstreamId,
    p_assignee_person_id: assigneePersonId,
    p_reviewer_person_id: reviewerPersonId,
    p_approver_person_id: approverPersonId,
    p_deadline: deadline,
    p_estimated_hours: estimatedHours,
    p_is_important: formData.get("is_important") === "on",
    p_is_urgent: formData.get("is_urgent") === "on",
  });

  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/my-work");
  revalidatePath("/member");
  revalidatePath("/head");
  revalidatePath("/overview");

  return { error: null, success: "เพิ่มงานแล้ว" };
}
