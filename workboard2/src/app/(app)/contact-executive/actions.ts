"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { bangkokLocalDateTimeToIso } from "@/lib/date-time";
import type { PlannerFormState } from "@/components/planner/action-form";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalStr(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value === "" ? null : value;
}

function refresh() {
  revalidatePath("/contact-executive");
  revalidatePath("/executive/inbox");
}

export async function sendQuestionAction(
  _state: PlannerFormState,
  formData: FormData,
): Promise<PlannerFormState> {
  const question = str(formData, "question");
  if (!question) return { error: "กรุณาพิมพ์คำถาม" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("send_executive_question", {
    p_question: question,
    p_recipient_person_id: optionalStr(formData, "recipient_person_id"),
  });

  if (error) return { error: error.message };
  refresh();
  return { error: null, success: "ส่งคำถามแล้ว" };
}

export async function withdrawQuestionAction(
  _state: PlannerFormState,
  formData: FormData,
): Promise<PlannerFormState> {
  const questionId = str(formData, "question_id");
  if (!questionId) return { error: "ไม่พบคำถาม" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_executive_question", {
    p_question_id: questionId,
  });

  if (error) return { error: error.message };
  refresh();
  return { error: null, success: "ถอนคำถามแล้ว" };
}

export async function createMeetingRequestAction(
  _state: PlannerFormState,
  formData: FormData,
): Promise<PlannerFormState> {
  const topic = str(formData, "topic");
  const startLocal = str(formData, "requested_start");
  const durationRaw = str(formData, "duration_minutes");

  if (!topic) return { error: "กรุณาระบุหัวข้อ" };
  if (!startLocal) return { error: "กรุณาระบุวันเวลาที่ต้องการนัด" };

  const duration = Number(durationRaw);
  if (!Number.isFinite(duration) || duration <= 0) {
    return { error: "ระยะเวลาต้องมากกว่า 0 นาที" };
  }

  let requestedStart: string;
  try {
    requestedStart = bangkokLocalDateTimeToIso(startLocal);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "วันเวลาไม่ถูกต้อง" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_meeting_request", {
    p_topic: topic,
    p_requested_start: requestedStart,
    p_duration_minutes: duration,
    p_location: optionalStr(formData, "location"),
    p_recipient_person_id: optionalStr(formData, "recipient_person_id"),
  });

  if (error) return { error: error.message };
  refresh();
  return { error: null, success: "ส่งคำขอนัดหมายแล้ว" };
}

export async function confirmMeetingRescheduleAction(
  _state: PlannerFormState,
  formData: FormData,
): Promise<PlannerFormState> {
  const requestId = str(formData, "request_id");
  if (!requestId) return { error: "ไม่พบคำขอนัดหมาย" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_meeting_reschedule", {
    p_request_id: requestId,
  });

  if (error) return { error: error.message };
  refresh();
  return { error: null, success: "ยืนยันเวลานัดหมายใหม่แล้ว" };
}

export async function cancelMeetingRequestAction(
  _state: PlannerFormState,
  formData: FormData,
): Promise<PlannerFormState> {
  const requestId = str(formData, "request_id");
  if (!requestId) return { error: "ไม่พบคำขอนัดหมาย" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_meeting_request", {
    p_request_id: requestId,
  });

  if (error) return { error: error.message };
  refresh();
  return { error: null, success: "ยกเลิกคำขอนัดหมายแล้ว" };
}
