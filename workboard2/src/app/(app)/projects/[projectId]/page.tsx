import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole, hasRoleInOrganization } from "@/lib/auth";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_HEALTH_LABELS,
  PROJECT_HEALTH_STYLES,
} from "@/lib/project-labels";
import { TASK_STATUS_LABELS } from "@/lib/task-labels";
import { checkProjectCompleteness } from "@/lib/project-completeness";
import { applyPlaybookAction } from "../actions";

export default async function ProjectDetailPage(
  props: PageProps<"/projects/[projectId]">,
) {
  const { projectId } = await props.params;

  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, organization_id, status, health, target_date, description")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) notFound();

  const canManage =
    hasRole(user, "ADMIN") ||
    hasRoleInOrganization(user, "HEAD", project.organization_id);

  // playbooks (the template list) only feeds the "ใช้ Playbook" panel, which
  // is only rendered for canManage — skip fetching it for everyone else.
  // playbook_tasks/playbook_conditional_rules are still always needed: they
  // feed checkProjectCompleteness(), shown to every viewer.
  const [
    { data: organization },
    { data: workstreams },
    { data: tasks },
    { data: playbooks },
    { data: playbookTasks },
    { data: conditionalRules },
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name")
      .eq("id", project.organization_id)
      .maybeSingle(),
    supabase
      .from("workstreams")
      .select("id, name, sort_order")
      .eq("project_id", projectId)
      .order("sort_order"),
    supabase
      .from("tasks")
      .select(
        "id, title, workstream_id, status, deadline, reviewer_person_id, current_holder_person_id, source_playbook_task_id",
      )
      .eq("project_id", projectId),
    canManage
      ? supabase.from("playbooks").select("id, key, name")
      : Promise.resolve({ data: [] as { id: string; key: string; name: string }[] }),
    supabase.from("playbook_tasks").select("id, tag"),
    supabase.from("playbook_conditional_rules").select("if_tag, then_tag, message"),
  ]);

  const holderIds = [
    ...new Set(
      (tasks ?? [])
        .map((t) => t.current_holder_person_id)
        .filter((id): id is string => id !== null),
    ),
  ];
  const { data: holders } = holderIds.length
    ? await supabase.from("people").select("id, full_name").in("id", holderIds)
    : { data: [] as { id: string; full_name: string }[] };
  const holderName = new Map((holders ?? []).map((h) => [h.id, h.full_name]));

  const taskTagById = new Map(
    (playbookTasks ?? [])
      .filter((pt) => pt.tag)
      .map((pt) => [pt.id, pt.tag as string]),
  );

  const issues = checkProjectCompleteness({
    project: { target_date: project.target_date },
    workstreams: workstreams ?? [],
    tasks: tasks ?? [],
    taskTagById,
    conditionalRules: conditionalRules ?? [],
  });

  const tasksByWorkstream = new Map<string | null, NonNullable<typeof tasks>>();
  for (const t of tasks ?? []) {
    const key = t.workstream_id;
    const list = tasksByWorkstream.get(key) ?? [];
    list.push(t);
    tasksByWorkstream.set(key, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-slate-400">{organization?.name}</div>
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <div className="mt-1 flex gap-2 text-xs">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
            {PROJECT_STATUS_LABELS[project.status]}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 font-medium ${PROJECT_HEALTH_STYLES[project.health]}`}
          >
            {PROJECT_HEALTH_LABELS[project.health]}
          </span>
        </div>
        {project.description && (
          <p className="mt-2 text-sm text-slate-600">{project.description}</p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold">กลุ่มงานและงาน</h2>
            {(workstreams ?? []).map((ws) => (
              <div key={ws.id} className="mb-4">
                <h3 className="mb-1 text-sm font-medium">{ws.name}</h3>
                <ul className="space-y-1 text-sm">
                  {(tasksByWorkstream.get(ws.id) ?? []).map((t) => (
                    <li
                      key={t.id}
                      className="flex justify-between border-t border-slate-100 py-1"
                    >
                      <Link href={`/tasks/${t.id}`} className="hover:underline">
                        {t.title}
                      </Link>
                      <span className="text-xs text-slate-400">
                        {TASK_STATUS_LABELS[t.status]} ·{" "}
                        {t.current_holder_person_id
                          ? (holderName.get(t.current_holder_person_id) ?? "-")
                          : "-"}
                      </span>
                    </li>
                  ))}
                  {(tasksByWorkstream.get(ws.id) ?? []).length === 0 && (
                    <li className="py-1 text-xs text-slate-400">ยังไม่มีงาน</li>
                  )}
                </ul>
              </div>
            ))}
            {(tasksByWorkstream.get(null) ?? []).length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-medium">งานนอกกลุ่มงาน</h3>
                <ul className="space-y-1 text-sm">
                  {(tasksByWorkstream.get(null) ?? []).map((t) => (
                    <li
                      key={t.id}
                      className="flex justify-between border-t border-slate-100 py-1"
                    >
                      <Link href={`/tasks/${t.id}`} className="hover:underline">
                        {t.title}
                      </Link>
                      <span className="text-xs text-slate-400">
                        {TASK_STATUS_LABELS[t.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(workstreams ?? []).length === 0 &&
              (tasksByWorkstream.get(null) ?? []).length === 0 && (
                <p className="text-sm text-slate-400">ยังไม่มีกลุ่มงานหรืองาน</p>
              )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold">ความครบถ้วนของโครงการ</h2>
            {issues.length === 0 ? (
              <p className="text-sm text-emerald-600">ครบถ้วนตามเกณฑ์ขั้นต่ำ</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {issues.map((issue, i) => (
                  <li
                    key={i}
                    className={
                      issue.severity === "error"
                        ? "text-red-600"
                        : "text-amber-600"
                    }
                  >
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canManage && (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold">ใช้ Playbook</h2>
              <div className="space-y-2">
                {(playbooks ?? []).map((pb) => (
                  <form key={pb.id} action={applyPlaybookAction}>
                    <input type="hidden" name="project_id" value={project.id} />
                    <input type="hidden" name="playbook_id" value={pb.id} />
                    <button className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-left text-sm hover:bg-slate-50">
                      {pb.name}
                    </button>
                  </form>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                กดซ้ำได้อย่างปลอดภัย ระบบจะสร้างเฉพาะงานที่ยังไม่เคยสร้างจาก
                Playbook นี้
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
