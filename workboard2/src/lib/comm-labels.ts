import type { Database } from "@/lib/database.types";

type QuestionStatus = Database["public"]["Tables"]["executive_questions"]["Row"]["status"];
type MeetingStatus = Database["public"]["Tables"]["meeting_requests"]["Row"]["status"];

export const QUESTION_STATUS_LABELS: Record<QuestionStatus, string> = {
  OPEN: "รอตอบ",
  ANSWERED: "ตอบแล้ว",
  WITHDRAWN: "ถอนแล้ว",
};

export const QUESTION_STATUS_STYLES: Record<QuestionStatus, string> = {
  OPEN: "bg-amber-100 text-amber-700",
  ANSWERED: "bg-emerald-100 text-emerald-700",
  WITHDRAWN: "bg-slate-100 text-slate-500",
};

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  PENDING: "รอการตอบรับ",
  ACCEPTED: "ยืนยันแล้ว",
  DECLINED: "ปฏิเสธ",
  RESCHEDULE_PROPOSED: "เสนอเวลาใหม่",
  CANCELLED: "ยกเลิกแล้ว",
};

export const MEETING_STATUS_STYLES: Record<MeetingStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  DECLINED: "bg-red-100 text-red-700",
  RESCHEDULE_PROPOSED: "bg-sky-100 text-sky-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};
