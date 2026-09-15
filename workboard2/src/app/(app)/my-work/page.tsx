import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { ACTIVE_TASK_STATUSES } from "@/lib/task-labels";
import {
  TaskListSection,
  type TaskListRow,
} from "@/components/tasks/task-list-section";
import type { PriorityLevel, TaskStatus } from "@/lib/database.types";
import {
  clockInAction,
  startBreakAction,
  resumeFromBreakAction,
  clockOutAction,
} from "./actions";
import { pauseTaskTimerAction } from "../tasks/actions";

function formatTime(value: string): string {
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

interface RawTask {
  id: string;
  title: string;
  project_id: string;
  deadline: string | null;
  priority: PriorityLevel;
  status: TaskStatus;
  current_holder_person_id: string | null;
}

const TASK_COLUMNS =
  "id, title, project_id, deadline, priority, status, current_holder_person_id";

export default async function MyWorkPage() {
  const user = await getCurrentUser();
  if (!user) {
    return null; // (app)/layout.tsx already handles the unauthenticated/unlinked cases
  }

  const supabase = await createClient();
  const personId = user.personId;
  const involvedFilter = `assignee_person_id.eq.${personId},reviewer_person_id.eq.${personId},approver_person_id.eq.${personId}`;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const weekAhead = new Date(todayStart.getTime() + 8 * 24 * 60 * 60 * 1000);

  const [
    { data: overdue },
    { data: waitingForMe },
    { data: dueToday },
    { data: p1 },
    { data: inProgress },
    { data: upcoming },
    { data: waitingForOthers },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .or(involvedFilter)
      .in("status", ACTIVE_TASK_STATUSES)
      .lt("deadline", now.toISOString())
      .order("deadline", { ascending: true }),
    supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .eq("current_holder_person_id", personId)
      .in("status", ACTIVE_TASK_STATUSES)
      .order("deadline", { ascending: true, nullsFirst: false }),
    supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .or(involvedFilter)
      .in("status", ACTIVE_TASK_STATUSES)
      .gte("deadline", now.toISOString())
      .lt("deadline", tomorrowStart.toISOString())
      .order("deadline", { ascending: true }),
    supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .or(involvedFilter)
      .in("status", ACTIVE_TASK_STATUSES)
      .eq("priority", "P1")
      .order("deadline", { ascending: true, nullsFirst: false }),
    supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .or(involvedFilter)
      .eq("status", "IN_PROGRESS")
      .order("deadline", { ascending: true, nullsFirst: false }),
    supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .or(involvedFilter)
      .in("status", ACTIVE_TASK_STATUSES)
      .gte("deadline", tomorrowStart.toISOString())
      .lt("deadline", weekAhead.toISOString())
      .order("deadline", { ascending: true }),
    supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .or(involvedFilter)
      .in("status", ACTIVE_TASK_STATUSES)
      .neq("current_holder_person_id", personId)
      .order("deadline", { ascending: true, nullsFirst: false }),
  ]);

  const allTasks: RawTask[] = [
    ...(overdue ?? []),
    ...(waitingForMe ?? []),
    ...(dueToday ?? []),
    ...(p1 ?? []),
    ...(inProgress ?? []),
    ...(upcoming ?? []),
    ...(waitingForOthers ?? []),
  ];

  const projectIds = [...new Set(allTasks.map((t) => t.project_id))];
  const holderIds = [
    ...new Set(
      allTasks
        .map((t) => t.current_holder_person_id)
        .filter((id): id is string => id !== null),
    ),
  ];

  const [{ data: projects }, { data: holders }] = await Promise.all([
    projectIds.length
      ? supabase.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    holderIds.length
      ? supabase.from("people").select("id, full_name").in("id", holderIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const projectNameById = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const holderNameById = new Map(
    (holders ?? []).map((h) => [h.id, h.full_name]),
  );

  const { data: attendanceSession } = await supabase
    .from("attendance_sessions")
    .select("id, clock_in_at")
    .eq("person_id", personId)
    .is("clock_out_at", null)
    .maybeSingle();

  const { data: activeBreak } = attendanceSession
    ? await supabase
        .from("attendance_breaks")
        .select("id, break_start_at")
        .eq("attendance_session_id", attendanceSession.id)
        .is("break_end_at", null)
        .maybeSingle()
    : { data: null };

  const { data: activeTimer } = await supabase
    .from("task_time_entries")
    .select("id, task_id, started_at")
    .eq("person_id", personId)
    .is("ended_at", null)
    .maybeSingle();

  const { data: activeTimerTask } = activeTimer
    ? await supabase.from("tasks").select("id, title").eq("id", activeTimer.task_id).maybeSingle()
    : { data: null };

  function toRows(tasks: RawTask[] | null): TaskListRow[] {
    return (tasks ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      projectName: projectNameById.get(t.project_id) ?? "-",
      deadline: t.deadline,
      priority: t.priority,
      status: t.status,
      currentHolderName: t.current_holder_person_id
        ? (holderNameById.get(t.current_holder_person_id) ?? null)
        : null,
      isCurrentHolderMe: t.current_holder_person_id === personId,
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">งานของฉัน</h1>
        <p className="text-sm text-slate-500">
          สวัสดี {user.fullName} — นี่คือสิ่งที่ต้องทำตอนนี้
        </p>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-sm">
          {!attendanceSession && <span className="text-slate-400">ยังไม่ได้ Clock In</span>}
          {attendanceSession && !activeBreak && (
            <span>เข้างานเมื่อ {formatTime(attendanceSession.clock_in_at)}</span>
          )}
          {attendanceSession && activeBreak && (
            <span className="text-amber-600">
              กำลังพักตั้งแต่ {formatTime(activeBreak.break_start_at)}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {!attendanceSession && (
            <form action={clockInAction}>
              <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white">
                Clock In
              </button>
            </form>
          )}
          {attendanceSession && !activeBreak && (
            <form action={startBreakAction}>
              <button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
                พัก
              </button>
            </form>
          )}
          {attendanceSession && activeBreak && (
            <form action={resumeFromBreakAction}>
              <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white">
                กลับมาทำงาน
              </button>
            </form>
          )}
          {attendanceSession && (
            <form action={clockOutAction}>
              <button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
                Clock Out
              </button>
            </form>
          )}
        </div>
      </section>

      {activeTimer && activeTimerTask && (
        <section className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <span>
            กำลังทำงาน:{" "}
            <Link href={`/tasks/${activeTimerTask.id}`} className="font-medium hover:underline">
              {activeTimerTask.title}
            </Link>{" "}
            (เริ่มเมื่อ {formatTime(activeTimer.started_at)})
          </span>
          <form action={pauseTaskTimerAction}>
            <input type="hidden" name="task_id" value={activeTimerTask.id} />
            <button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
              หยุดชั่วคราว
            </button>
          </form>
        </section>
      )}

      <TaskListSection
        title="เกินกำหนด"
        description="ต้องจัดการก่อนอย่างอื่น"
        tasks={toRows(overdue)}
      />
      <TaskListSection
        title="รอฉัน"
        description="ตอนนี้ลูกบอลอยู่ที่คุณ"
        tasks={toRows(waitingForMe)}
      />
      <TaskListSection title="ต้องทำวันนี้" tasks={toRows(dueToday)} />
      <TaskListSection title="ลำดับความสำคัญสูงสุด (P1)" tasks={toRows(p1)} />
      <TaskListSection title="กำลังทำ" tasks={toRows(inProgress)} />
      <TaskListSection
        title="จะถึงกำหนด"
        description="ภายใน 7 วันข้างหน้า"
        tasks={toRows(upcoming)}
      />
      <TaskListSection
        title="รอคนอื่น"
        description="อยู่ระหว่างรอผู้อื่นดำเนินการ"
        tasks={toRows(waitingForOthers)}
      />
    </div>
  );
}
