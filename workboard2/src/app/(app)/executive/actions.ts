"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth";

export interface ExecutiveSuggestionState {
  error: string | null;
  success?: string | null;
}

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createPrioritySuggestionAction(
  _state: ExecutiveSuggestionState,
  formData: FormData,
): Promise<ExecutiveSuggestionState> {
  const user = await getCurrentUser();
  if (!user || (!hasRole(user, "ADMIN") && !hasRole(user, "EXECUTIVE"))) {
    return { error: "ไม่มีสิทธิ์เสนอการจัดลำดับความสำคัญ" };
  }

  const taskId = value(formData, "task_id");
  const priority = value(formData, "priority");
  const reason = value(formData, "reason");

  if (!taskId || !["P1", "P2", "P3", "P4"].includes(priority)) {
    return { error: "กรุณาเลือกงานและระดับความสำคัญ" };
  }

  const flags = {
    P1: { important: true, urgent: true },
    P2: { important: true, urgent: false },
    P3: { important: false, urgent: true },
    P4: { important: false, urgent: false },
  } as const;

  const selected = flags[priority as keyof typeof flags];
  const supabase = await createClient();

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, assignee_person_id")
    .eq("id", taskId)
    .maybeSingle();

  if (taskError || !task) return { error: "ไม่พบงานนี้" };

  const { error } = await supabase.from("suggestions").insert({
    task_id: taskId,
    suggested_by: user.personId,
    suggested_is_important: selected.important,
    suggested_is_urgent: selected.urgent,
    reason: reason || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/executive");
  revalidatePath("/weekly-plan");
  revalidatePath("/member");
  return { error: null, success: "ส่งคำแนะนำให้ผู้รับผิดชอบแล้ว" };
}
