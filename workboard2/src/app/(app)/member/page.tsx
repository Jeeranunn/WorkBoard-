import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { ACTIVE_TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/task-labels";
import { bangkokTodayKey, formatThaiDateTime } from "@/lib/date-time";
import { LiveElapsedTime } from "@/components/time/live-elapsed-time";
import { QuickPriorityForm } from "@/components/tasks/quick-priority-form";

export default async function MemberWorkspacePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const today = bangkokTodayKey();

  const [
    { data: attendance },
    { data: activeTimer },
    { data: tasks },
    { data: slots },
    { data: personalItems },
    { data: suggestions },
  ] = await Promise.all([
    supabase
      .from("attendance_sessions")
      .select("id, clock_in_at")
      .eq("person_id", user.personId)
      .is("clock_out_at", null)
      .maybeSingle(),
    supabase
      .from("task_time_entries")
      .select("id, task_id, started_at")
      .eq("person_id", user.personId)
      .is("ended_at", null)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select("id, title, status, priority, deadline, current_holder_person_id, is_important, is_urgent")
      .or(
        `assignee_person_id.eq.${user.personId},reviewer_person_id.eq.${user.personId},approver_person_id.eq.${user.personId}`,
      )
      .in("status", ACTIVE_TASK_STATUSES)
      .order("deadline", { ascending: true, nullsFirst: false }),
    supabase
      .from("planned_slots")
      .select("id, date, start_time, end_time, workboard_task_id, personal_planner_item_id")
      .eq("person_id", user.personId)
      .gte("date", today)
      .order("date")
      .order("start_time")
      .limit(8),
    supabase
      .from("personal_planner_items")
      .select("id, title, deadline, completed_at")
      .eq("person_id", user.personId)
      .is("completed_at", null)
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(5),
    supabase
      .from("suggestions")
      .select("id, task_id")
      .in("status", ["pending", "accepted"])
      .is("applied_at", null),
  ]);

  const activeTask = activeTimer
    ? (tasks ?? []).find((task) => task.id === activeTimer.task_id)
    : null;

  const waitingForMe = (tasks ?? []).filter(
    (task) => task.current_holder_person_id === user.personId,
  );
  const overdue = (tasks ?? []).filter(
    (task) => task.deadline && task.deadline < nowIso,
  );
  const p1 = (tasks ?? []).filter((task) => task.priority === "P1");

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm text-slate-500">พื้นที่สมาชิก</p>
        <h1 className="mt-1 text-2xl font-semibold">วันนี้ของ {user.fullName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          รวมสิ่งที่ต้องทำ เวลา และแผนส่วนตัวไว้ในหน้าเดียว
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/my-work" className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-sm">
          <div className="text-xs text-slate-500">รอฉันดำเนินการ</div>
          <div className="mt-2 text-2xl font-semibold">{waitingForMe.length}</div>
        </Link>
        <Link href="/my-work" className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-sm">
          <div className="text-xs text-slate-500">เกินกำหนด</div>
          <div className="mt-2 text-2xl font-semibold text-red-600">{overdue.length}</div>
        </Link>
        <Link href="/my-work" className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-sm">
          <div className="text-xs text-slate-500">P1</div>
          <div className="mt-2 text-2xl font-semibold">{p1.length}</div>
        </Link>
        <Link href="/weekly-plan" className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-sm">
          <div className="text-xs text-slate-500">คำแนะนำที่ต้องจัดการ</div>
          <div className="mt-2 text-2xl font-semibold">{(suggestions ?? []).length}</div>
        </Link>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">สถานะการทำงานตอนนี้</h2>
          <div className="mt-4 rounded-lg bg-slate-50 p-4">
            <div className="text-sm">
              {attendance ? (
                <>Clock In เมื่อ {formatThaiDateTime(attendance.clock_in_at)}</>
              ) : (
                <span className="text-slate-500">ยังไม่ได้ Clock In</span>
              )}
            </div>

            {activeTimer && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-sm font-medium">
                  {activeTask?.title ?? "กำลังจับเวลางาน"}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-emerald-700">
                  <span>ใช้เวลาแล้ว</span>
                  <LiveElapsedTime
                    startedAt={activeTimer.started_at}
                    className="font-mono text-lg font-semibold tabular-nums"
                  />
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/my-work"
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              >
                จัดการเวลาและงาน
              </Link>
              <Link
                href="/weekly-plan"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium"
              >
                เปิดแผนรายสัปดาห์
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">งานส่วนตัวที่ยังไม่เสร็จ</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {(personalItems ?? []).map((item) => (
              <div key={item.id} className="py-3">
                <div className="text-sm font-medium">{item.title}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {item.deadline ? `กำหนด ${formatThaiDateTime(item.deadline)}` : "ไม่มีกำหนด"}
                </div>
              </div>
            ))}
            {(personalItems ?? []).length === 0 && (
              <p className="py-5 text-center text-sm text-slate-400">ยังไม่มีรายการ</p>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">สิ่งที่รอคุณทำต่อ</h2>
            <p className="text-xs text-slate-500">เรียงตามกำหนดส่ง</p>
          </div>
          <Link href="/my-work" className="text-sm font-medium hover:underline">ดูทั้งหมด</Link>
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {waitingForMe.slice(0, 8).map((task) => (
            <div key={task.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1 hover:bg-slate-50">
                  <div className="truncate text-sm font-medium">{task.title}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {TASK_STATUS_LABELS[task.status]}
                    {task.deadline ? ` · ${formatThaiDateTime(task.deadline)}` : ""}
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium">
                    {task.priority}
                  </span>
                  <Link
                    href={`/tasks/${task.id}`}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium"
                  >
                    แก้ไข
                  </Link>
                </div>
              </div>
              <QuickPriorityForm
                taskId={task.id}
                isImportant={task.is_important}
                isUrgent={task.is_urgent}
              />
            </div>
          ))}
          {waitingForMe.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">ไม่มีงานที่รอคุณอยู่ตอนนี้</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">แผนที่วางไว้</h2>
            <p className="text-xs text-slate-500">รายการถัดไปจาก Weekly Planner</p>
          </div>
          <Link href="/weekly-plan" className="text-sm font-medium hover:underline">จัดแผน</Link>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(slots ?? []).map((slot) => (
            <div key={slot.id} className="rounded-lg border border-slate-200 p-3 text-sm">
              <div className="text-xs text-slate-400">{slot.date}</div>
              <div className="mt-1 font-medium">{slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}</div>
            </div>
          ))}
          {(slots ?? []).length === 0 && (
            <p className="text-sm text-slate-400">ยังไม่มีแผนที่วางไว้</p>
          )}
        </div>
      </section>
    </div>
  );
}
