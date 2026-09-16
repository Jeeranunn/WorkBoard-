import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { ACTIVE_TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/task-labels";
import { formatThaiDateTime } from "@/lib/date-time";

const ROLE_LABELS = {
  ADMIN: "ผู้ดูแลระบบ",
  EXECUTIVE: "ผู้บริหาร",
  HEAD: "หัวหน้าฝ่าย",
  MEMBER: "สมาชิก",
} as const;

export default async function OverviewPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const now = new Date().toISOString();

  const [
    { count: waitingForMeCount },
    { count: overdueCount },
    { count: visibleProjectCount },
    { count: pendingApprovalCount },
    { data: nextTasks },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("current_holder_person_id", user.personId)
      .in("status", ACTIVE_TASK_STATUSES),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("status", ACTIVE_TASK_STATUSES)
      .lt("deadline", now),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING_APPROVAL"),
    supabase
      .from("tasks")
      .select("id, title, deadline, priority, status")
      .eq("current_holder_person_id", user.personId)
      .in("status", ACTIVE_TASK_STATUSES)
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(5),
  ]);

  const isLeadership = hasRole(user, "ADMIN") || hasRole(user, "EXECUTIVE");
  const roleLabels = [...new Set(user.roles.map((grant) => ROLE_LABELS[grant.role]))];

  const stats = [
    {
      label: "รอฉันดำเนินการ",
      value: waitingForMeCount ?? 0,
      href: "/my-work",
    },
    {
      label: "งานเกินกำหนดที่ฉันมองเห็น",
      value: overdueCount ?? 0,
      href: "/my-work",
    },
    {
      label: "โครงการที่เข้าถึงได้",
      value: visibleProjectCount ?? 0,
      href: "/projects",
    },
    {
      label: isLeadership ? "งานรออนุมัติ" : "แผนสัปดาห์นี้",
      value: isLeadership ? (pendingApprovalCount ?? 0) : "เปิดดู",
      href: isLeadership ? "/executive" : "/weekly-plan",
    },
  ];

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">ภาพรวมวันนี้</p>
          <h1 className="mt-1 text-2xl font-semibold">สวัสดี {user.fullName}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {roleLabels.length ? roleLabels.join(" · ") : "สมาชิก"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/weekly-plan"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            วางแผนสัปดาห์
          </Link>
          <Link
            href="/my-work"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            ไปงานของฉัน
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
          >
            <div className="text-xs text-slate-500">{stat.label}</div>
            <div className="mt-2 text-2xl font-semibold">{stat.value}</div>
          </Link>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">สิ่งที่คุณต้องทำต่อ</h2>
              <p className="text-xs text-slate-500">
                แสดงจาก Current Action Holder ไม่ใช่แค่งานที่คุณเป็นผู้รับผิดชอบ
              </p>
            </div>
            <Link href="/my-work" className="text-sm font-medium hover:underline">
              ดูทั้งหมด
            </Link>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {(nextTasks ?? []).map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{task.title}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {TASK_STATUS_LABELS[task.status]}
                    {task.deadline
                      ? ` · กำหนด ${formatThaiDateTime(task.deadline)}`
                      : ""}
                  </div>
                </div>
                <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-xs font-medium">
                  {task.priority}
                </span>
              </Link>
            ))}
            {(nextTasks ?? []).length === 0 && (
              <div className="py-8 text-center text-sm text-slate-400">
                ไม่มีงานที่รอคุณดำเนินการตอนนี้
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">ทางลัดตามบทบาท</h2>
          <div className="mt-3 space-y-2 text-sm">
            <Link
              href="/weekly-plan"
              className="block rounded-lg border border-slate-200 px-3 py-3 hover:bg-slate-50"
            >
              <div className="font-medium">แผนรายสัปดาห์</div>
              <div className="mt-1 text-xs text-slate-500">
                วางงาน WorkBoard + งานส่วนตัว + เวลาว่างในที่เดียว
              </div>
            </Link>

            <Link
              href="/teams"
              className="block rounded-lg border border-slate-200 px-3 py-3 hover:bg-slate-50"
            >
              <div className="font-medium">ทีม</div>
              <div className="mt-1 text-xs text-slate-500">
                ดูภาระงาน ความคืบหน้า และโครงการของทีม
              </div>
            </Link>

            {isLeadership && (
              <Link
                href="/executive"
                className="block rounded-lg border border-slate-200 px-3 py-3 hover:bg-slate-50"
              >
                <div className="font-medium">ภาพรวมผู้บริหาร</div>
                <div className="mt-1 text-xs text-slate-500">
                  งานเสี่ยง งานค้าง งานรออนุมัติ และภาพรวมทั้งเครือข่าย
                </div>
              </Link>
            )}

            {hasRole(user, "ADMIN") && (
              <Link
                href="/admin/members"
                className="block rounded-lg border border-slate-200 px-3 py-3 hover:bg-slate-50"
              >
                <div className="font-medium">จัดการสมาชิกและบทบาท</div>
                <div className="mt-1 text-xs text-slate-500">
                  เชื่อมบัญชี กำหนดบทบาท และดูแลโครงสร้างระบบ
                </div>
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
