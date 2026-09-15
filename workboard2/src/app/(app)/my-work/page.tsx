import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { ACTIVE_TASK_STATUSES } from "@/lib/task-labels";
import {
  TaskListSection,
  type TaskListRow,
} from "@/components/tasks/task-list-section";
import type { PriorityLevel, TaskStatus } from "@/lib/database.types";

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
