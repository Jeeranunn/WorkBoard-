"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { bangkokLocalDateTimeToIso } from "@/lib/date-time";
import type { PlannerFormState } from "@/components/planner/action-form";
import type { Database } from "@/lib/database.types";

type MeetingStatus = Database["public"]["Tables"]["meeting_requests"]["Row"]["status"];

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalStr(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value === "" ? null : value;
}

function refresh() {
  revalidatePath("/executive/inbox");
  revalidatePath("/contact-executive");
  revalidatePath("/head/memos");
}

export async function replyToQuestionAction(
  _state: PlannerFormState,
  formData: FormData,
): Promise<PlannerFormState> {
  const questionId = str(formData, "question_id");
  const body = str(formData, "body");
  if (!questionId) return { error: "ไม่พบคำถาม" };
  if (!body) return { error: "กรุณาพิมพ์คำตอบ" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reply_executive_question", {
    p_question_id: questionId,
    p_body: body,
  });

  if (error) return { error: error.message };
  refresh();
  return { error: null, success: "ตอบคำถามแล้ว" };
}

export async function respondMeetingRequestAction(
  _state: PlannerFormState,
  formData: FormData,
): Promise<PlannerFormState> {
  const requestId = str(formData, "request_id");
  const status = str(formData, "status") as MeetingStatus;
  if (!requestId) return { error: "ไม่พบคำขอนัดหมาย" };
  if (!["ACCEPTED", "DECLINED", "RESCHEDULE_PROPOSED"].includes(status)) {
    return { error: "สถานะไม่ถูกต้อง" };
  }

  let proposedStart: string | null = null;
  if (status === "RESCHEDULE_PROPOSED") {
    const proposedLocal = str(formData, "proposed_start");
    if (!proposedLocal) return { error: "กรุณาระบุเวลาที่เสนอใหม่" };
    try {
      proposedStart = bangkokLocalDateTimeToIso(proposedLocal);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "วันเวลาไม่ถูกต้อง" };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_meeting_request", {
    p_request_id: requestId,
    p_status: status,
    p_remark: optionalStr(formData, "remark"),
    p_proposed_start: proposedStart,
    p_proposed_location: optionalStr(formData, "proposed_location"),
  });

  if (error) return { error: error.message };
  refresh();
  const successByStatus: Record<string, string> = {
    ACCEPTED: "ยืนยันนัดหมายแล้ว",
    DECLINED: "ปฏิเสธคำขอนัดหมายแล้ว",
    RESCHEDULE_PROPOSED: "เสนอเวลาใหม่แล้ว",
  };
  return { error: null, success: successByStatus[status] };
}

export async function acknowledgeMemoAction(
  _state: PlannerFormState,
  formData: FormData,
): Promise<PlannerFormState> {
  const memoId = str(formData, "memo_id");
  if (!memoId) return { error: "ไม่พบบันทึกข้อความ" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("acknowledge_management_memo", {
    p_memo_id: memoId,
  });

  if (error) return { error: error.message };
  refresh();
  return { error: null, success: "รับทราบแล้ว" };
}
