"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface AttendanceFormState {
  error: string | null;
}

async function callAttendanceRpc(
  fn: "clock_in" | "start_break" | "resume_from_break" | "clock_out",
): Promise<AttendanceFormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn);
  if (error) return { error: error.message };
  revalidatePath("/my-work");
  revalidatePath("/overview");
  return { error: null };
}

export async function clockInAction(
  _state: AttendanceFormState,
  _formData: FormData,
): Promise<AttendanceFormState> {
  return callAttendanceRpc("clock_in");
}

export async function startBreakAction(
  _state: AttendanceFormState,
  _formData: FormData,
): Promise<AttendanceFormState> {
  return callAttendanceRpc("start_break");
}

export async function resumeFromBreakAction(
  _state: AttendanceFormState,
  _formData: FormData,
): Promise<AttendanceFormState> {
  return callAttendanceRpc("resume_from_break");
}

export async function clockOutAction(
  _state: AttendanceFormState,
  _formData: FormData,
): Promise<AttendanceFormState> {
  return callAttendanceRpc("clock_out");
}
