"use server";

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

export interface WorkflowFormState {
  error: string | null;
  success?: string | null;
}

async function callTaskRpc(
  taskId: string,
  fn:
    | "acknowledge_task"
    | "start_task"
    | "submit_task"
    | "begin_review"
    | "request_revision"
    | "resubmit_task"
    | "submit_for_approval"
    | "approve_task"
    | "complete_task",
  args: Record<string, unknown>,
): Promise<WorkflowFormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args as never);
  if (error) return { error: error.message };

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/my-work");
  revalidatePath("/member");
  revalidatePath("/head");
  revalidatePath("/overview");
  return { error: null };
}

export async function acknowledgeTaskAction(
  _state: WorkflowFormState,
  formData: FormData,
): Promise<WorkflowFormState> {
  const taskId = str(formData, "task_id");
  return callTaskRpc(taskId, "acknowledge_task", { p_task_id: taskId });
}

export async function startTaskAction(
  _state: WorkflowFormState,
  formData: FormData,
): Promise<WorkflowFormState> {
  const taskId = str(formData, "task_id");
  return callTaskRpc(taskId, "start_task", { p_task_id: taskId });
}

export async function submitTaskAction(
  _state: WorkflowFormState,
  formData: FormData,
): Promise<WorkflowFormState> {
  const taskId = str(formData, "task_id");
  return callTaskRpc(taskId, "submit_task", {
    p_task_id: taskId,
    p_message: optionalStr(formData, "message"),
    p_link: optionalStr(formData, "link"),
  });
}

export async function beginReviewAction(
  _state: WorkflowFormState,
  formData: FormData,
): Promise<WorkflowFormState> {
  const taskId = str(formData, "task_id");
  return callTaskRpc(taskId, "begin_review", { p_task_id: taskId });
}

export async function requestRevisionAction(
  _state: WorkflowFormState,
  formData: FormData,
): Promise<WorkflowFormState> {
  const taskId = str(formData, "task_id");
  return callTaskRpc(taskId, "request_revision", {
    p_task_id: taskId,
    p_note: optionalStr(formData, "note"),
  });
}

export async function resubmitTaskAction(
  _state: WorkflowFormState,
  formData: FormData,
): Promise<WorkflowFormState> {
  const taskId = str(formData, "task_id");
  return callTaskRpc(taskId, "resubmit_task", {
    p_task_id: taskId,
    p_message: optionalStr(formData, "message"),
    p_link: optionalStr(formData, "link"),
  });
}

export async function submitForApprovalAction(
  _state: WorkflowFormState,
  formData: FormData,
): Promise<WorkflowFormState> {
  const taskId = str(formData, "task_id");
  return callTaskRpc(taskId, "submit_for_approval", { p_task_id: taskId });
}

export async function approveTaskAction(
  _state: WorkflowFormState,
  formData: FormData,
): Promise<WorkflowFormState> {
  const taskId = str(formData, "task_id");
  return callTaskRpc(taskId, "approve_task", { p_task_id: taskId });
}

export async function completeTaskAction(
  _state: WorkflowFormState,
  formData: FormData,
): Promise<WorkflowFormState> {
  const taskId = str(formData, "task_id");
  return callTaskRpc(taskId, "complete_task", { p_task_id: taskId });
}

// Timer actions are wired through useActionState (see
// src/components/tasks/timer-action-form.tsx) instead of being passed
// directly to <form action={...}>. A Server Action bound directly to a
// form has no way to report a thrown error back to the page — Next.js
// redacts a thrown error's message in production, and there is no
// re-render to show it in anyway — so a rejected RPC call (task status
// wrong, not clocked in, already has a timer running elsewhere, ...)
// looked to the user like the button silently did nothing. Returning a
// state object instead means the real ข้อความ from the RPC always reaches
// the page.
export interface TimerFormState {
  error: string | null;
}

const initialTimerFormState: TimerFormState = { error: null };

export async function startTaskTimerAction(
  _prevState: TimerFormState,
  formData: FormData,
): Promise<TimerFormState> {
  const taskId = str(formData, "task_id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_task_timer", { p_task_id: taskId });
  if (error) return { error: error.message };
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/my-work");
  revalidatePath("/member");
  revalidatePath("/head");
  return initialTimerFormState;
}

export async function switchTaskTimerAction(
  _prevState: TimerFormState,
  formData: FormData,
): Promise<TimerFormState> {
  const taskId = str(formData, "task_id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("switch_task_timer", { p_task_id: taskId });
  if (error) return { error: error.message };
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/my-work");
  revalidatePath("/member");
  revalidatePath("/head");
  return initialTimerFormState;
}

export async function pauseTaskTimerAction(
  _prevState: TimerFormState,
  formData: FormData,
): Promise<TimerFormState> {
  const taskId = optionalStr(formData, "task_id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("pause_task_timer");
  if (error) return { error: error.message };
  if (taskId) revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/my-work");
  revalidatePath("/member");
  revalidatePath("/head");
  return initialTimerFormState;
}

export interface CommentFormState {
  error: string | null;
  success?: string | null;
}

export async function addCommentAction(
  _state: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  const taskId = str(formData, "task_id");
  const body = str(formData, "body");
  if (!taskId || !body) return { error: "กรุณาเขียนความคิดเห็นหรือคำถาม" };
  const isQuestion = formData.get("is_question") === "on";

  const user = await getCurrentUser();
  if (!user) return { error: "ต้องเข้าสู่ระบบ" };

  const supabase = await createClient();
  const { error } = await supabase.from("task_comments").insert({
    task_id: taskId,
    author_person_id: user.personId,
    body,
    is_question: isQuestion,
  });
  if (error) return { error: error.message };

  revalidatePath(`/tasks/${taskId}`);
  return { error: null, success: "ส่งความคิดเห็นแล้ว" };
}


export interface TaskEditFormState {
  error: string | null;
  success?: string | null;
}

export async function updateTaskPriorityAction(
  _state: TaskEditFormState,
  formData: FormData,
): Promise<TaskEditFormState> {
  const taskId = str(formData, "task_id");
  if (!taskId) return { error: "ไม่พบงาน" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_task_priority", {
    p_task_id: taskId,
    p_is_important: formData.get("is_important") === "on",
    p_is_urgent: formData.get("is_urgent") === "on",
  });

  if (error) return { error: error.message };

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/my-work");
  revalidatePath("/member");
  revalidatePath("/overview");
  revalidatePath("/head");
  revalidatePath("/executive");
  return { error: null, success: "อัปเดต Priority แล้ว" };
}

export async function updateManualTaskDetailsAction(
  _state: TaskEditFormState,
  formData: FormData,
): Promise<TaskEditFormState> {
  const taskId = str(formData, "task_id");
  const title = str(formData, "title");
  const description = str(formData, "description");
  const deadlineRaw = str(formData, "deadline");
  const estimatedRaw = str(formData, "estimated_hours");

  if (!taskId || !title) return { error: "กรุณาใส่ชื่องาน" };

  const estimated = estimatedRaw ? Number(estimatedRaw) : null;
  if (estimated !== null && (!Number.isFinite(estimated) || estimated <= 0)) {
    return { error: "ชั่วโมงโดยประมาณต้องมากกว่า 0" };
  }

  let deadline: string | null = null;
  try {
    deadline = deadlineRaw ? bangkokLocalDateTimeToIso(deadlineRaw) : null;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "วันเวลาไม่ถูกต้อง" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_manual_task_details", {
    p_task_id: taskId,
    p_title: title,
    p_description: description || null,
    p_deadline: deadline,
    p_estimated_hours: estimated,
    p_is_important: formData.get("is_important") === "on",
    p_is_urgent: formData.get("is_urgent") === "on",
  });

  if (error) return { error: error.message };

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/my-work");
  revalidatePath("/member");
  revalidatePath("/overview");
  revalidatePath("/head");
  revalidatePath("/executive");
  return { error: null, success: "แก้ไขงานแล้ว" };
}

export async function cancelTaskAction(
  _state: TaskEditFormState,
  formData: FormData,
): Promise<TaskEditFormState> {
  const taskId = str(formData, "task_id");
  if (!taskId) return { error: "ไม่พบงาน" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_task_from_active_work", {
    p_task_id: taskId,
  });

  if (error) return { error: error.message };

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/my-work");
  revalidatePath("/member");
  revalidatePath("/overview");
  revalidatePath("/head");
  revalidatePath("/executive");
  return { error: null, success: "นำงานออกจากงานที่ใช้งานแล้ว และเก็บประวัติไว้" };
}
