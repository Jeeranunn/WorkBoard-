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
import { TimerActionForm } from "@/components/tasks/timer-action-form";
import { AttendanceActionForm } from "@/components/time/attendance-action-form";
import { LiveElapsedTime } from "@/components/time/live-elapsed-time";

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
  const nowIso = now.toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStartIso = tomorrowStart.toISOString();
  const weekAheadIso = new Date(todayStart.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString();

  // The 7 buckets below (overdue/waitingForMe/dueToday/p1/inProgress/upcoming/
  // waitingForOthers) used to be 7 separate queries, but every one of them is
  // a subset of "tasks I'm involved in, still active" — current_holder is
  // always one of assignee/reviewer/approver (see compute_task_current_holder
  // in 0006), and IN_PROGRESS is already inside ACTIVE_TASK_STATUSES — so a
  // single fetch plus in-memory bucketing produces identical results in one
  // round trip instead of seven. A task can still appear in multiple
  // sections at once (e.g. an overdue P1 task), matching the prior behavior.
  const { data: involvedTasks } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .or(involvedFilter)
    .in("status", ACTIVE_TASK_STATUSES);

  const allTasks: RawTask[] = involvedTasks ?? [];

  const byDeadlineAsc = (a: RawTask, b: RawTask) => {
    const aTime = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const bTime = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    return aTime - bTime;
  };

  const overdue = allTasks
    .filter((t) => t.deadline && t.deadline < nowIso)
    .sort(byDeadlineAsc);
  const waitingForMe = allTasks
    .filter((t) => t.current_holder_person_id === personId)
    .sort(byDeadlineAsc);
  const dueToday = allTasks
    .filter((t) => t.deadline && t.deadline >= nowIso && t.deadline < tomorrowStartIso)
    .sort(byDeadlineAsc);
  const p1 = allTasks.filter((t) => t.priority === "P1").sort(byDeadlineAsc);
  const inProgress = allTasks.filter((t) => t.status === "IN_PROGRESS").sort(byDeadlineAsc);
  const upcoming = allTasks
    .filter((t) => t.deadline && t.deadline >= tomorrowStartIso && t.deadline < weekAheadIso)
    .sort(byDeadlineAsc);
  const waitingForOthers = allTasks
    .filter(
      (t) => t.current_holder_person_id !== null && t.current_holder_person_id !== personId,
    )
    .sort(byDeadlineAsc);

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

  // Attendance (session -> break) and task timer (timer -> its task) are two
  // independent chains — each step only depends on its own prior step, not
  // on the other chain — so each round only waits on the slower of the two,
  // instead of all four running one after another.
  const [{ data: attendanceSession }, { data: activeTimer }] = await Promise.all([
    supabase
      .from("attendance_sessions")
      .select("id, clock_in_at")
      .eq("person_id", personId)
      .is("clock_out_at", null)
      .maybeSingle(),
    supabase
      .from("task_time_entries")
      .select("id, task_id, started_at")
      .eq("person_id", personId)
      .is("ended_at", null)
      .maybeSingle(),
  ]);

  const [{ data: activeBreak }, { data: activeTimerTask }] = await Promise.all([
    attendanceSession
      ? supabase
          .from("attendance_breaks")
          .select("id, break_start_at")
          .eq("attendance_session_id", attendanceSession.id)
          .is("break_end_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    activeTimer
      ? supabase.from("tasks").select("id, title").eq("id", activeTimer.task_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

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
            <AttendanceActionForm
              action={clockInAction}
              label="Clock In"
              pendingLabel="กำลังเข้างาน..."
              buttonClassName="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
            />
          )}
          {attendanceSession && !activeBreak && (
            <AttendanceActionForm
              action={startBreakAction}
              label="พัก"
              pendingLabel="กำลังพัก..."
              buttonClassName="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          )}
          {attendanceSession && activeBreak && (
            <AttendanceActionForm
              action={resumeFromBreakAction}
              label="กลับมาทำงาน"
              pendingLabel="กำลังกลับมาทำงาน..."
              buttonClassName="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
            />
          )}
          {attendanceSession && (
            <AttendanceActionForm
              action={clockOutAction}
              label="Clock Out"
              pendingLabel="กำลังออกงาน..."
              buttonClassName="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          )}
        </div>
      </section>

      {activeTimer && activeTimerTask && (
        <section className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <div>
            <div>
              กำลังทำงาน:{" "}
              <Link href={`/tasks/${activeTimerTask.id}`} className="font-medium hover:underline">
                {activeTimerTask.title}
              </Link>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-emerald-700">
              <span>ใช้เวลาแล้ว</span>
              <LiveElapsedTime
                startedAt={activeTimer.started_at}
                className="font-mono text-base font-semibold tabular-nums"
              />
              <span className="text-slate-500">· เริ่ม {formatTime(activeTimer.started_at)}</span>
            </div>
          </div>
          <TimerActionForm
            action={pauseTaskTimerAction}
            taskId={activeTimerTask.id}
            buttonLabel="หยุดชั่วคราว"
            pendingLabel="กำลังหยุด..."
            buttonClassName="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
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
