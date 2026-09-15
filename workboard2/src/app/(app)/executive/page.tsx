import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import {
  PROJECT_HEALTH_LABELS,
  PROJECT_HEALTH_STYLES,
} from "@/lib/project-labels";
import { ACTIVE_TASK_STATUSES } from "@/lib/task-labels";
import type { ProjectHealth } from "@/lib/database.types";

interface TaskSummary {
  id: string;
  title: string;
  project_id: string;
  status: string;
  deadline: string | null;
  is_blocked: boolean;
  current_holder_person_id: string | null;
}

function AttentionList({
  title,
  tasks,
  projectNameById,
}: {
  title: string;
  tasks: TaskSummary[];
  projectNameById: Map<string, string>;
}) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-medium text-slate-500">
        {title} ({tasks.length})
      </h3>
      <ul className="space-y-1 text-sm">
        {tasks.slice(0, 8).map((t) => (
          <li key={t.id}>
            <Link href={`/tasks/${t.id}`} className="hover:underline">
              {t.title}
            </Link>
            <span className="ml-1 text-xs text-slate-400">
              — {projectNameById.get(t.project_id) ?? "-"}
            </span>
          </li>
        ))}
        {tasks.length === 0 && <li className="text-xs text-slate-400">ไม่มี</li>}
      </ul>
    </div>
  );
}

export default async function ExecutiveDashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  if (!hasRole(user, "ADMIN") && !hasRole(user, "EXECUTIVE")) {
    redirect("/overview");
  }

  const supabase = await createClient();

  const [
    { data: networks },
    { data: organizations },
    { data: projects },
    { data: tasks },
  ] = await Promise.all([
    supabase.from("networks").select("id, name"),
    supabase.from("organizations").select("id, name, network_id"),
    supabase
      .from("projects")
      .select("id, name, organization_id, status, health"),
    supabase
      .from("tasks")
      .select(
        "id, title, project_id, status, deadline, is_blocked, current_holder_person_id",
      ),
  ]);

  const projectNameById = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const now = new Date().toISOString();
  const activeTasks = (tasks ?? []).filter((t) =>
    ACTIVE_TASK_STATUSES.includes(t.status as (typeof ACTIVE_TASK_STATUSES)[number]),
  );

  const overdue = activeTasks.filter((t) => t.deadline && t.deadline < now);
  const blocked = activeTasks.filter((t) => t.is_blocked);
  const waitingReview = activeTasks.filter((t) =>
    ["SUBMITTED", "IN_REVIEW", "RESUBMITTED"].includes(t.status),
  );
  const waitingApproval = activeTasks.filter((t) => t.status === "PENDING_APPROVAL");

  const healthCounts: Record<ProjectHealth, number> = {
    ON_TRACK: 0,
    AT_RISK: 0,
    OFF_TRACK: 0,
  };
  for (const p of projects ?? []) healthCounts[p.health]++;

  const workloadCount = new Map<string, number>();
  for (const t of activeTasks) {
    if (!t.current_holder_person_id) continue;
    workloadCount.set(
      t.current_holder_person_id,
      (workloadCount.get(t.current_holder_person_id) ?? 0) + 1,
    );
  }
  const topHolderIds = [...workloadCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);
  const { data: holderPeople } = topHolderIds.length
    ? await supabase.from("people").select("id, full_name").in("id", topHolderIds)
    : { data: [] as { id: string; full_name: string }[] };
  const holderName = new Map((holderPeople ?? []).map((h) => [h.id, h.full_name]));

  const orgsByNetwork = new Map<string, typeof organizations>();
  for (const o of organizations ?? []) {
    const list = orgsByNetwork.get(o.network_id) ?? [];
    list.push(o);
    orgsByNetwork.set(o.network_id, list);
  }
  const projectsByOrg = new Map<string, typeof projects>();
  for (const p of projects ?? []) {
    const list = projectsByOrg.get(p.organization_id) ?? [];
    list.push(p);
    projectsByOrg.set(p.organization_id, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">ภาพรวมผู้บริหาร</h1>
        <p className="text-sm text-slate-500">
          เครือข่าย → องค์กร → โครงการ ทั้งหมดในระบบ
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-400">งานที่เปิดอยู่ทั้งหมด</div>
          <div className="text-2xl font-semibold">{activeTasks.length}</div>
        </div>
        {(["ON_TRACK", "AT_RISK", "OFF_TRACK"] as const).map((h) => (
          <div key={h} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-400">
              โครงการ{PROJECT_HEALTH_LABELS[h]}
            </div>
            <div
              className={`inline-block rounded px-1.5 text-2xl font-semibold ${PROJECT_HEALTH_STYLES[h]}`}
            >
              {healthCounts[h]}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">ต้องให้ความสนใจ</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <AttentionList
            title="เกินกำหนด"
            tasks={overdue}
            projectNameById={projectNameById}
          />
          <AttentionList
            title="ติดขัด"
            tasks={blocked}
            projectNameById={projectNameById}
          />
          <AttentionList
            title="รอตรวจ"
            tasks={waitingReview}
            projectNameById={projectNameById}
          />
          <AttentionList
            title="รออนุมัติ"
            tasks={waitingApproval}
            projectNameById={projectNameById}
          />
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-4 md:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">โครงสร้างองค์กร → โครงการ</h2>
          <div className="space-y-4">
            {(networks ?? []).map((n) => (
              <div key={n.id}>
                <div className="text-sm font-medium">{n.name}</div>
                <div className="ml-4 mt-1 space-y-2">
                  {(orgsByNetwork.get(n.id) ?? []).map((o) => (
                    <div key={o.id}>
                      <div className="text-xs font-medium text-slate-500">
                        {o.name}
                      </div>
                      <ul className="ml-4 space-y-0.5">
                        {(projectsByOrg.get(o.id) ?? []).map((p) => (
                          <li key={p.id} className="flex items-center gap-2 text-sm">
                            <Link href={`/projects/${p.id}`} className="hover:underline">
                              {p.name}
                            </Link>
                            <span
                              className={`rounded px-1 text-xs ${PROJECT_HEALTH_STYLES[p.health]}`}
                            >
                              {PROJECT_HEALTH_LABELS[p.health]}
                            </span>
                          </li>
                        ))}
                        {(projectsByOrg.get(o.id) ?? []).length === 0 && (
                          <li className="text-xs text-slate-400">ยังไม่มีโครงการ</li>
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">Workload (ผู้ถือครองงานมากที่สุด)</h2>
          <ul className="space-y-1 text-sm">
            {topHolderIds.map((id) => (
              <li key={id} className="flex justify-between">
                <span>{holderName.get(id) ?? "-"}</span>
                <span className="text-slate-400">{workloadCount.get(id)} งาน</span>
              </li>
            ))}
            {topHolderIds.length === 0 && (
              <li className="text-xs text-slate-400">ไม่มีข้อมูล</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
