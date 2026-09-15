"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import type { PlannerFormState } from "@/components/planner/action-form";

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("ต้องเข้าสู่ระบบ");
  return user;
}

function refreshPlanner() {
  revalidatePath("/weekly-plan");
  revalidatePath("/my-work");
  revalidatePath("/overview");
}

export async function addPersonalItemAction(
  _state: PlannerFormState,
  formData: FormData,
): Promise<PlannerFormState> {
  const title = value(formData, "title");
  const deadline = value(formData, "deadline");
  const estimatedHoursRaw = value(formData, "estimated_hours");

  if (!title) return { error: "กรุณาใส่ชื่องานส่วนตัว" };

  const estimatedHours = estimatedHoursRaw ? Number(estimatedHoursRaw) : null;
  if (
    estimatedHours !== null &&
    (!Number.isFinite(estimatedHours) || estimatedHours <= 0)
  ) {
    return { error: "ชั่วโมงโดยประมาณต้องมากกว่า 0" };
  }

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("personal_planner_items").insert({
    person_id: user.personId,
    title,
    deadline: deadline ? new Date(deadline).toISOString() : null,
    estimated_hours: estimatedHours,
    is_important: formData.get("is_important") === "on",
    is_urgent: formData.get("is_urgent") === "on",
  });

  if (error) return { error: error.message };
  refreshPlanner();
  return { error: null, success: "เพิ่มรายการแล้ว" };
}

export async function togglePersonalItemAction(
  _state: PlannerFormState,
  formData: FormData,
): Promise<PlannerFormState> {
  const itemId = value(formData, "item_id");
  const nextCompleted = value(formData, "next_completed") === "true";
  if (!itemId) return { error: "ไม่พบรายการ" };

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("personal_planner_items")
    .update({ completed_at: nextCompleted ? new Date().toISOString() : null })
    .eq("id", itemId);

  if (error) return { error: error.message };
  refreshPlanner();
  return { error: null, success: nextCompleted ? "ทำเสร็จแล้ว" : "เปิดรายการอีกครั้งแล้ว" };
}

export async function addAvailabilityAction(
  _state: PlannerFormState,
  formData: FormData,
): Promise<PlannerFormState> {
  const date = value(formData, "date");
  const startTime = value(formData, "start_time");
  const endTime = value(formData, "end_time");
  const status = value(formData, "status") as "free" | "busy" | "maybe";
  const note = value(formData, "note");

  if (!date || !startTime || !endTime) {
    return { error: "กรุณาเลือกวันและเวลาให้ครบ" };
  }
  if (!["free", "busy", "maybe"].includes(status)) {
    return { error: "สถานะช่วงเวลาไม่ถูกต้อง" };
  }
  if (endTime <= startTime) {
    return { error: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม" };
  }

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("availability").insert({
    person_id: user.personId,
    date,
    start_time: startTime,
    end_time: endTime,
    status,
    note: note || null,
  });

  if (error) return { error: error.message };
  refreshPlanner();
  return { error: null, success: "บันทึกเวลาว่างแล้ว" };
}

export async function addPlannedSlotAction(
  _state: PlannerFormState,
  formData: FormData,
): Promise<PlannerFormState> {
  const source = value(formData, "source");
  const date = value(formData, "date");
  const startTime = value(formData, "start_time");
  const endTime = value(formData, "end_time");

  if (!source || !date || !startTime || !endTime) {
    return { error: "กรุณาเลือกงาน วัน และเวลาให้ครบ" };
  }
  if (endTime <= startTime) {
    return { error: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม" };
  }

  const [kind, id] = source.split(":");
  if (!id || !["task", "personal"].includes(kind)) {
    return { error: "แหล่งงานไม่ถูกต้อง" };
  }

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("planned_slots").insert({
    person_id: user.personId,
    workboard_task_id: kind === "task" ? id : null,
    personal_planner_item_id: kind === "personal" ? id : null,
    date,
    start_time: startTime,
    end_time: endTime,
  });

  if (error) return { error: error.message };
  refreshPlanner();
  return { error: null, success: "วางลงตารางแล้ว" };
}

export async function respondSuggestionAction(
  _state: PlannerFormState,
  formData: FormData,
): Promise<PlannerFormState> {
  const suggestionId = value(formData, "suggestion_id");
  const status = value(formData, "status");
  if (!suggestionId || !["accepted", "rejected"].includes(status)) {
    return { error: "ข้อมูลคำแนะนำไม่ถูกต้อง" };
  }

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_suggestion", {
    p_suggestion_id: suggestionId,
    p_status: status,
  });

  if (error) return { error: error.message };
  refreshPlanner();
  return {
    error: null,
    success: status === "accepted" ? "รับคำแนะนำแล้ว" : "ปฏิเสธคำแนะนำแล้ว",
  };
}
