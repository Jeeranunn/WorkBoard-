import type { TaskStatus, WorkOrigin } from "@/lib/database.types";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  ASSIGNED: "มอบหมายแล้ว",
  ACKNOWLEDGED: "รับทราบแล้ว",
  IN_PROGRESS: "กำลังทำ",
  SUBMITTED: "ส่งงานแล้ว",
  IN_REVIEW: "กำลังตรวจ",
  REVISION_REQUIRED: "ต้องแก้ไข",
  RESUBMITTED: "ส่งงานใหม่แล้ว",
  APPROVED: "อนุมัติแล้ว",
  COMPLETED: "เสร็จสมบูรณ์",
  CANCELLED: "ยกเลิก",
};

export const WORK_ORIGIN_LABELS: Record<WorkOrigin, string> = {
  PLANNED: "งานตามแผน",
  ADDED: "งานเพิ่มเติม",
  SCOPE_CHANGE: "การเปลี่ยนขอบเขต",
};

// Statuses where the task still needs someone to act on it.
export const ACTIVE_TASK_STATUSES: TaskStatus[] = [
  "ASSIGNED",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "SUBMITTED",
  "IN_REVIEW",
  "REVISION_REQUIRED",
  "RESUBMITTED",
];

export const TERMINAL_TASK_STATUSES: TaskStatus[] = [
  "APPROVED",
  "COMPLETED",
  "CANCELLED",
];
