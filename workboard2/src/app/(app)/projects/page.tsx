import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_HEALTH_LABELS,
  PROJECT_HEALTH_STYLES,
} from "@/lib/project-labels";
import { ACTIVE_TASK_STATUSES } from "@/lib/task-labels";

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();

  const [{ data: projects }, { data: organizations }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, organization_id, status, health, target_date")
      .order("created_at", { ascending: false }),
    supabase.from("organizations").select("id, name"),
  ]);

  const projectIds = (projects ?? []).map((p) => p.id);
  const { data: openTasks } = projectIds.length
    ? await supabase
        .from("tasks")
        .select("project_id")
        .in("project_id", projectIds)
        .in("status", ACTIVE_TASK_STATUSES)
    : { data: [] as { project_id: string }[] };

  const openCountByProject = new Map<string, number>();
  for (const t of openTasks ?? []) {
    openCountByProject.set(
      t.project_id,
      (openCountByProject.get(t.project_id) ?? 0) + 1,
    );
  }

  const orgNameById = new Map((organizations ?? []).map((o) => [o.id, o.name]));
  const canCreate =
    hasRole(user, "ADMIN") || user.roles.some((r) => r.role === "HEAD");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">โครงการ</h1>
          <p className="text-sm text-slate-500">รายการโครงการที่คุณเข้าถึงได้</p>
        </div>
        {canCreate && (
          <Link
            href="/projects/new"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
          >
            สร้างโครงการ
          </Link>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-slate-400">
              <th className="px-4 py-2">ชื่อโครงการ</th>
              <th className="px-4 py-2">องค์กร</th>
              <th className="px-4 py-2">สถานะ</th>
              <th className="px-4 py-2">ความคืบหน้า</th>
              <th className="px-4 py-2">งานที่เปิดอยู่</th>
              <th className="px-4 py-2">กำหนดเสร็จ</th>
            </tr>
          </thead>
          <tbody>
            {(projects ?? []).map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  <Link
                    href={`/projects/${p.id}`}
                    className="font-medium hover:underline"
                  >
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {orgNameById.get(p.organization_id) ?? "-"}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {PROJECT_STATUS_LABELS[p.status]}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${PROJECT_HEALTH_STYLES[p.health]}`}
                  >
                    {PROJECT_HEALTH_LABELS[p.health]}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {openCountByProject.get(p.id) ?? 0}
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {p.target_date ?? "-"}
                </td>
              </tr>
            ))}
            {(projects ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-slate-400">
                  ยังไม่มีโครงการ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
