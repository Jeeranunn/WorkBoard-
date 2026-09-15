"use server";

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
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args as never);
  if (error) throw new Error(error.message);
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/my-work");
}

export async function acknowledgeTaskAction(formData: FormData) {
  const taskId = str(formData, "task_id");
  await callTaskRpc(taskId, "acknowledge_task", { p_task_id: taskId });
}

export async function startTaskAction(formData: FormData) {
  const taskId = str(formData, "task_id");
  await callTaskRpc(taskId, "start_task", { p_task_id: taskId });
}

export async function submitTaskAction(formData: FormData) {
  const taskId = str(formData, "task_id");
  await callTaskRpc(taskId, "submit_task", {
    p_task_id: taskId,
    p_message: optionalStr(formData, "message"),
    p_link: optionalStr(formData, "link"),
  });
}

export async function beginReviewAction(formData: FormData) {
  const taskId = str(formData, "task_id");
  await callTaskRpc(taskId, "begin_review", { p_task_id: taskId });
}

export async function requestRevisionAction(formData: FormData) {
  const taskId = str(formData, "task_id");
  await callTaskRpc(taskId, "request_revision", {
    p_task_id: taskId,
    p_note: optionalStr(formData, "note"),
  });
}

export async function resubmitTaskAction(formData: FormData) {
  const taskId = str(formData, "task_id");
  await callTaskRpc(taskId, "resubmit_task", {
    p_task_id: taskId,
    p_message: optionalStr(formData, "message"),
    p_link: optionalStr(formData, "link"),
  });
}

export async function submitForApprovalAction(formData: FormData) {
  const taskId = str(formData, "task_id");
  await callTaskRpc(taskId, "submit_for_approval", { p_task_id: taskId });
}

export async function approveTaskAction(formData: FormData) {
  const taskId = str(formData, "task_id");
  await callTaskRpc(taskId, "approve_task", { p_task_id: taskId });
}

export async function completeTaskAction(formData: FormData) {
  const taskId = str(formData, "task_id");
  await callTaskRpc(taskId, "complete_task", { p_task_id: taskId });
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
  return initialTimerFormState;
}

export async function addCommentAction(formData: FormData) {
  const taskId = str(formData, "task_id");
  const body = str(formData, "body");
  if (!body) return;
  const isQuestion = formData.get("is_question") === "on";

  const user = await getCurrentUser();
  if (!user) throw new Error("ต้องเข้าสู่ระบบ");

  const supabase = await createClient();
  const { error } = await supabase.from("task_comments").insert({
    task_id: taskId,
    author_person_id: user.personId,
    body,
    is_question: isQuestion,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/tasks/${taskId}`);
}
