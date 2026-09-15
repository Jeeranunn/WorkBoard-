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
