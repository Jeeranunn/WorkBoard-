import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import {
  PROJECT_HEALTH_LABELS,
  PROJECT_HEALTH_STYLES,
} from "@/lib/project-labels";
import { ACTIVE_TASK_STATUSES } from "@/lib/task-labels";
import type { ProjectHealth } from "@/lib/database.types";
import { PrioritySuggestionForm } from "@/components/executive/priority-suggestion-form";

// The one genuinely sequential query on this page — it needs topHolderIds,
// computed from the tasks already fetched above — so it's the one part of
// the dashboard worth streaming in behind the rest: the stat tiles,
// attention lists, and network/org/project/task tree render and reach the
// browser immediately instead of waiting on this last small lookup too.
async function WorkloadPanel({
  topHolderIds,
  workloadCount,
}: {
  topHolderIds: string[];
  workloadCount: Map<string, number>;
}) {
  const supabase = await createClient();
  const { data: holderPeople } = topHolderIds.length
    ? await supabase.from("people").select("id, full_name").in("id", topHolderIds)
    : { data: [] as { id: string; full_name: string }[] };
  const holderName = new Map((holderPeople ?? []).map((h) => [h.id, h.full_name]));

  return (
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
  );
}

function WorkloadPanelSkeleton() {
  return (
    <ul className="animate-pulse space-y-2">
      {[0, 1, 2].map((i) => (
        <li key={i} className="h-4 rounded bg-slate-100" />
      ))}
    </ul>
  );
}

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
        "id, title, project_id, status, priority, deadline, is_blocked, current_holder_person_id",
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
  const tasksByProject = new Map<string, NonNullable<typeof tasks>>();
  for (const t of tasks ?? []) {
    const list = tasksByProject.get(t.project_id) ?? [];
    list.push(t);
    tasksByProject.set(t.project_id, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">ภาพรวมผู้บริหาร</h1>
          <p className="text-sm text-slate-500">
            เครือข่าย → องค์กร → โครงการ ทั้งหมดในระบบ
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/executive/capacity"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            ดู Capacity
          </Link>
          <a
            href="/executive/export"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            ดาวน์โหลดรายงาน CSV
          </a>
        </div>
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

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold">เสนอปรับ Priority</h2>
          <p className="mb-3 text-xs text-slate-500">
            เป็นคำแนะนำให้ผู้รับผิดชอบพิจารณา ไม่เปลี่ยน Priority ของงานโดยอัตโนมัติ
          </p>
          <PrioritySuggestionForm
            tasks={activeTasks.map((task) => ({
              id: task.id,
              title: task.title,
              projectName: projectNameById.get(task.project_id) ?? "-",
            }))}
          />
        </section>


      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-4 md:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">
            เครือข่าย → องค์กร → โครงการ → งาน
          </h2>
          <p className="mb-3 text-xs text-slate-400">
            กดเพื่อขยาย/ย่อแต่ละระดับ
          </p>
          <div className="space-y-2">
            {(networks ?? []).map((n) => (
              <details key={n.id} open className="group">
                <summary className="cursor-pointer text-sm font-medium">
                  {n.name}
                </summary>
                <div className="ml-4 mt-1 space-y-2">
                  {(orgsByNetwork.get(n.id) ?? []).map((o) => (
                    <details key={o.id}>
                      <summary className="cursor-pointer text-xs font-medium text-slate-500">
                        {o.name}
                      </summary>
                      <ul className="ml-4 mt-1 space-y-1">
                        {(projectsByOrg.get(o.id) ?? []).map((p) => (
                          <li key={p.id} className="text-sm">
                            <details>
                              <summary className="cursor-pointer">
                                <Link
                                  href={`/projects/${p.id}`}
                                  className="hover:underline"
                                >
                                  {p.name}
                                </Link>
                                <span
                                  className={`ml-2 rounded px-1 text-xs ${PROJECT_HEALTH_STYLES[p.health]}`}
                                >
                                  {PROJECT_HEALTH_LABELS[p.health]}
                                </span>
                              </summary>
                              <ul className="ml-5 mt-1 space-y-0.5 text-xs">
                                {(tasksByProject.get(p.id) ?? []).map((t) => (
                                  <li key={t.id} className="flex justify-between gap-2">
                                    <Link
                                      href={`/tasks/${t.id}`}
                                      className="truncate hover:underline"
                                    >
                                      {t.title}
                                    </Link>
                                    <span className="shrink-0 text-slate-400">
                                      {t.priority} · {t.status}
                                    </span>
                                  </li>
                                ))}
                                {(tasksByProject.get(p.id) ?? []).length === 0 && (
                                  <li className="text-slate-400">ยังไม่มีงาน</li>
                                )}
                              </ul>
                            </details>
                          </li>
                        ))}
                        {(projectsByOrg.get(o.id) ?? []).length === 0 && (
                          <li className="text-xs text-slate-400">ยังไม่มีโครงการ</li>
                        )}
                      </ul>
                    </details>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">Workload (ผู้ถือครองงานมากที่สุด)</h2>
          <Suspense fallback={<WorkloadPanelSkeleton />}>
            <WorkloadPanel topHolderIds={topHolderIds} workloadCount={workloadCount} />
          </Suspense>
        </section>
      </div>
    </div>
  );
}
