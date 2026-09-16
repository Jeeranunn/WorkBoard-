import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { TASK_STATUS_LABELS } from "@/lib/task-labels";
import { formatThaiDateTime } from "@/lib/date-time";

const COLUMNS = [
  {
    key: "incoming",
    label: "ยังไม่เริ่ม",
    statuses: ["ASSIGNED", "ACKNOWLEDGED"],
  },
  {
    key: "doing",
    label: "กำลังทำ",
    statuses: ["IN_PROGRESS", "REVISION_REQUIRED"],
  },
  {
    key: "review",
    label: "รอตรวจ / กำลังตรวจ",
    statuses: ["SUBMITTED", "RESUBMITTED", "IN_REVIEW"],
  },
  {
    key: "approval",
    label: "รออนุมัติ",
    statuses: ["PENDING_APPROVAL"],
  },
] as const;

export default async function ManagementBoardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isManager =
    hasRole(user, "ADMIN") ||
    hasRole(user, "EXECUTIVE") ||
    user.roles.some((grant) => grant.role === "HEAD");

  if (!isManager) redirect("/member");

  const supabase = await createClient();
  const [{ data: tasks }, { data: projects }, { data: people }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id, title, project_id, status, priority, deadline, assignee_person_id, is_blocked, is_waiting",
        )
        .not("status", "in", "(APPROVED,COMPLETED,CANCELLED)")
        .order("deadline", { ascending: true, nullsFirst: false }),
      supabase
        .from("projects")
        .select("id, name, organization_id")
        .eq("is_active", true),
      supabase.from("people").select("id, full_name"),
    ]);

  const projectName = new Map((projects ?? []).map((item) => [item.id, item.name]));
  const personName = new Map((people ?? []).map((item) => [item.id, item.full_name]));

  const grouped = new Map<string, NonNullable<typeof tasks>>();
  for (const column of COLUMNS) grouped.set(column.key, []);
  for (const task of tasks ?? []) {
    const column = COLUMNS.find((item) =>
      item.statuses.includes(task.status as never),
    );
    if (column) grouped.get(column.key)?.push(task);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">บอร์ดบริหาร</p>
          <h1 className="mt-1 text-2xl font-semibold">ภาพรวมงานที่กำลังเดิน</h1>
          <p className="mt-1 text-sm text-slate-500">
            ดูงานตามสถานะจริง พร้อม Priority ผู้รับผิดชอบ และจุดที่ติดขัด
          </p>
        </div>
        <div className="flex gap-2">
          {hasRole(user, "EXECUTIVE") || hasRole(user, "ADMIN") ? (
            <Link
              href="/executive"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
            >
              ภาพรวมผู้บริหาร
            </Link>
          ) : null}
          {user.roles.some((grant) => grant.role === "HEAD") || hasRole(user, "ADMIN") ? (
            <Link
              href="/head"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
            >
              พื้นที่หัวหน้าฝ่าย
            </Link>
          ) : null}
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-4">
        {COLUMNS.map((column) => {
          const items = grouped.get(column.key) ?? [];
          return (
            <div
              key={column.key}
              className="min-h-[360px] rounded-xl border border-slate-200 bg-slate-100/60 p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{column.label}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                  {items.length}
                </span>
              </div>

              <div className="space-y-3">
                {items.map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="block rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{task.title}</div>
                        <div className="mt-1 truncate text-xs text-slate-400">
                          {projectName.get(task.project_id) ?? "-"}
                        </div>
                      </div>
                      <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-xs font-semibold">
                        {task.priority}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1 text-xs text-slate-500">
                      <div>{TASK_STATUS_LABELS[task.status]}</div>
                      <div>
                        ผู้รับผิดชอบ: {personName.get(task.assignee_person_id) ?? "-"}
                      </div>
                      <div>
                        {task.deadline
                          ? `กำหนด ${formatThaiDateTime(task.deadline)}`
                          : "ยังไม่มีกำหนดส่ง"}
                      </div>
                    </div>

                    {(task.is_blocked || task.is_waiting) && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {task.is_blocked && (
                          <span className="rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">
                            ติดขัด
                          </span>
                        )}
                        {task.is_waiting && (
                          <span className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                            รอ
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                ))}

                {items.length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 px-3 py-8 text-center text-xs text-slate-400">
                    ไม่มีงานในสถานะนี้
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
