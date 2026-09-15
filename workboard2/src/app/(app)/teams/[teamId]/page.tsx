import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_TASK_STATUSES } from "@/lib/task-labels";

const TEAM_TYPE_LABELS: Record<string, string> = {
  WORKING: "Working Team",
  PROJECT: "Project Team",
};

export default async function TeamDetailPage(
  props: PageProps<"/teams/[teamId]">,
) {
  const { teamId } = await props.params;
  const supabase = await createClient();

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, team_type, network_id, owner_organization_id")
    .eq("id", teamId)
    .maybeSingle();

  if (!team) notFound();

  const [{ data: memberships }, { data: teamProjects }] = await Promise.all([
    supabase
      .from("team_memberships")
      .select("person_id, role_in_team")
      .eq("team_id", teamId)
      .is("valid_to", null),
    supabase
      .from("team_projects")
      .select("project_id")
      .eq("team_id", teamId)
      .is("valid_to", null),
  ]);

  const memberIds = (memberships ?? []).map((m) => m.person_id);

  const [{ data: people }, { data: projects }, { data: tasks }, { data: activeTimers }] = await Promise.all([
    memberIds.length
      ? supabase.from("people").select("id, full_name").in("id", memberIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    (teamProjects ?? []).length
      ? supabase
          .from("projects")
          .select("id, name")
          .in("id", (teamProjects ?? []).map((tp) => tp.project_id))
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    memberIds.length
      ? supabase
          .from("tasks")
          .select("id, title, assignee_person_id, status, priority, deadline")
          .in("assignee_person_id", memberIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            title: string;
            assignee_person_id: string;
            status: string;
            priority: string;
            deadline: string | null;
          }[],
        }),
    memberIds.length
      ? supabase
          .from("task_time_entries")
          .select("person_id")
          .in("person_id", memberIds)
          .is("ended_at", null)
      : Promise.resolve({ data: [] as { person_id: string }[] }),
  ]);

  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const now = new Date().toISOString();
  const activeTasks = (tasks ?? []).filter((t) =>
    ACTIVE_TASK_STATUSES.includes(t.status as (typeof ACTIVE_TASK_STATUSES)[number]),
  );

  const backlogByMember = new Map<string, number>();
  const p1ByMember = new Map<string, number>();
  const overdueByMember = new Map<string, number>();
  for (const t of activeTasks) {
    backlogByMember.set(t.assignee_person_id, (backlogByMember.get(t.assignee_person_id) ?? 0) + 1);
    if (t.priority === "P1") {
      p1ByMember.set(t.assignee_person_id, (p1ByMember.get(t.assignee_person_id) ?? 0) + 1);
    }
    if (t.deadline && t.deadline < now) {
      overdueByMember.set(t.assignee_person_id, (overdueByMember.get(t.assignee_person_id) ?? 0) + 1);
    }
  }

  const waitingReview = activeTasks.filter((t) =>
    ["SUBMITTED", "IN_REVIEW", "RESUBMITTED", "PENDING_APPROVAL"].includes(t.status),
  );

  const setupIssues: string[] = [];
  if ((memberships ?? []).length === 0) {
    setupIssues.push("ทีมนี้ยังไม่มีสมาชิก");
  }
  if ((teamProjects ?? []).length === 0) {
    setupIssues.push("ทีมนี้ยังไม่ผูกกับโครงการใด");
  }
  const idleMembers = memberIds.filter((id) => !backlogByMember.has(id));

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-slate-400">
          {TEAM_TYPE_LABELS[team.team_type] ?? team.team_type}
        </div>
        <h1 className="text-xl font-semibold">{team.name}</h1>
      </div>

      {setupIssues.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          <h2 className="mb-1 text-sm font-semibold">การตั้งค่าทีมยังไม่ครบ</h2>
          <ul className="list-disc pl-4">
            {setupIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-400">กำลังทำงานอยู่ตอนนี้</div>
          <div className="text-2xl font-semibold text-emerald-600">
            {new Set((activeTimers ?? []).map((t) => t.person_id)).size}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-400">งานค้างทั้งหมด</div>
          <div className="text-2xl font-semibold">{activeTasks.length}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-400">P1</div>
          <div className="text-2xl font-semibold">
            {activeTasks.filter((t) => t.priority === "P1").length}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-400">เกินกำหนด</div>
          <div className="text-2xl font-semibold text-red-600">
            {activeTasks.filter((t) => t.deadline && t.deadline < now).length}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-400">รอตรวจ/รออนุมัติ</div>
          <div className="text-2xl font-semibold">{waitingReview.length}</div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">สมาชิก</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-400">
                <th className="pb-2">ชื่อ</th>
                <th className="pb-2">งานค้าง</th>
                <th className="pb-2">P1</th>
                <th className="pb-2">เกินกำหนด</th>
              </tr>
            </thead>
            <tbody>
              {memberIds.map((id) => (
                <tr key={id} className="border-t border-slate-100">
                  <td className="py-1.5">
                    {nameById.get(id) ?? "-"}
                    {idleMembers.includes(id) && (
                      <span className="ml-1 text-xs text-slate-400">(ยังไม่มีงาน)</span>
                    )}
                  </td>
                  <td className="py-1.5">{backlogByMember.get(id) ?? 0}</td>
                  <td className="py-1.5">{p1ByMember.get(id) ?? 0}</td>
                  <td className="py-1.5 text-red-600">{overdueByMember.get(id) ?? 0}</td>
                </tr>
              ))}
              {memberIds.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-400">
                    ยังไม่มีสมาชิก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">โครงการที่ทีมนี้ทำ</h2>
          <ul className="space-y-1 text-sm">
            {(projects ?? []).map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="hover:underline">
                  {p.name}
                </Link>
              </li>
            ))}
            {(projects ?? []).length === 0 && (
              <li className="text-xs text-slate-400">ยังไม่มีโครงการ</li>
            )}
          </ul>

          <h2 className="mb-3 mt-4 text-sm font-semibold">รอตรวจ/รออนุมัติ</h2>
          <ul className="space-y-1 text-sm">
            {waitingReview.slice(0, 10).map((t) => (
              <li key={t.id}>
                <Link href={`/tasks/${t.id}`} className="hover:underline">
                  {t.title}
                </Link>
              </li>
            ))}
            {waitingReview.length === 0 && (
              <li className="text-xs text-slate-400">ไม่มี</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
