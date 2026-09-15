"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function callAttendanceRpc(
  fn: "clock_in" | "start_break" | "resume_from_break" | "clock_out",
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn);
  if (error) throw new Error(error.message);
  revalidatePath("/my-work");
}

export async function clockInAction() {
  await callAttendanceRpc("clock_in");
}

export async function startBreakAction() {
  await callAttendanceRpc("start_break");
}

export async function resumeFromBreakAction() {
  await callAttendanceRpc("resume_from_break");
}

export async function clockOutAction() {
  await callAttendanceRpc("clock_out");
}
