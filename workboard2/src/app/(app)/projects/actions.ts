"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

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
  const { data, error } = await supabase
    .from("projects")
    .insert({
      organization_id: organizationId,
      owner_person_id: user.personId,
      name,
      description: optionalStr(formData, "description"),
      start_date: optionalStr(formData, "start_date"),
      target_date: optionalStr(formData, "target_date"),
    })
    .select("id")
    .single();
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
