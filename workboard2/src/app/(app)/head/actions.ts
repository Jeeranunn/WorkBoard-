"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole, hasRoleInOrganization } from "@/lib/auth";

export interface HeadTaskFormState {
  error: string | null;
  success?: string | null;
}

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

async function personBelongsToOrganization(
  personId: string,
  organizationId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("person_organization_ids", {
    check_person_id: personId,
  });
  if (error) return false;
  return (data ?? []).includes(organizationId);
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
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, project_id")
    .eq("id", taskId)
    .maybeSingle();

  if (taskError || !task) return { error: "ไม่พบงานนี้" };

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("organization_id")
    .eq("id", task.project_id)
    .maybeSingle();

  if (projectError || !project) return { error: "ไม่พบโครงการของงานนี้" };

  const canManage =
    hasRole(user, "ADMIN") ||
    hasRoleInOrganization(user, "HEAD", project.organization_id);

  if (!canManage) {
    return { error: "คุณไม่มีสิทธิ์จัดการงานขององค์กรนี้" };
  }

  const peopleToCheck = [
    assigneePersonId,
    reviewerPersonId,
    approverPersonId,
  ].filter((id): id is string => Boolean(id));

  const membershipChecks = await Promise.all(
    peopleToCheck.map((personId) =>
      personBelongsToOrganization(personId, project.organization_id),
    ),
  );

  if (membershipChecks.some((belongs) => !belongs)) {
    return { error: "ผู้รับผิดชอบ/ผู้ตรวจ/ผู้อนุมัติต้องอยู่ในองค์กรเดียวกับโครงการ" };
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      assignee_person_id: assigneePersonId,
      reviewer_person_id: reviewerPersonId,
      approver_person_id: approverPersonId,
    })
    .eq("id", taskId);

  if (error) return { error: error.message };

  revalidatePath("/head");
  revalidatePath("/my-work");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath(`/projects/${task.project_id}`);

  return { error: null, success: "อัปเดตผู้รับผิดชอบและสายตรวจงานแล้ว" };
}
