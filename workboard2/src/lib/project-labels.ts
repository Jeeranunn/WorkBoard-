import type { ProjectHealth, ProjectStatus } from "@/lib/database.types";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: "วางแผน",
  ACTIVE: "ดำเนินการอยู่",
  ON_HOLD: "พักไว้",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
};

export const PROJECT_HEALTH_LABELS: Record<ProjectHealth, string> = {
  ON_TRACK: "ปกติ",
  AT_RISK: "เสี่ยง",
  OFF_TRACK: "หลุดเป้า",
};

export const PROJECT_HEALTH_STYLES: Record<ProjectHealth, string> = {
  ON_TRACK: "bg-emerald-100 text-emerald-700",
  AT_RISK: "bg-amber-100 text-amber-700",
  OFF_TRACK: "bg-red-100 text-red-700",
};
