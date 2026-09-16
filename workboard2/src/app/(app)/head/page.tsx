import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { ACTIVE_TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/task-labels";
import { formatThaiDateTime } from "@/lib/date-time";
import { TaskPeopleForm } from "@/components/head/task-people-form";

export default async function HeadWorkspacePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isAdmin = hasRole(user, "ADMIN");
  const headOrgIds = [
    ...new Set(
      user.roles
        .filter((grant) => grant.role === "HEAD" && grant.organizationId)
        .map((grant) => grant.organizationId as string),
    ),
  ];

  if (!isAdmin && headOrgIds.length === 0) {
    redirect("/overview");
  }

  const supabase = await createClient();

  const { data: organizations } = isAdmin
    ? await supabase.from("organizations").select("id, name").eq("is_active", true).order("name")
    : await supabase.from("organizations").select("id, name").in("id", headOrgIds).order("name");

  const orgIds = (organizations ?? []).map((org) => org.id);

  const { data: units } = orgIds.length
    ? await supabase
        .from("organization_units")
        .select("id, organization_id, name")
        .in("organization_id", orgIds)
        .is("valid_to", null)
    : { data: [] as { id: string; organization_id: string; name: string }[] };

  const unitIds = (units ?? []).map((unit) => unit.id);

  const { data: positions } = unitIds.length
    ? await supabase
        .from("positions")
        .select("id, unit_id, title")
        .in("unit_id", unitIds)
        .is("valid_to", null)
    : { data: [] as { id: string; unit_id: string; title: string }[] };

  const positionIds = (positions ?? []).map((position) => position.id);

  const { data: appointments } = positionIds.length
    ? await supabase
        .from("appointments")
        .select("person_id, position_id")
        .in("position_id", positionIds)
        .is("valid_to", null)
    : { data: [] as { person_id: string; position_id: string }[] };

  const memberIds = [
    ...new Set((appointments ?? []).map((appointment) => appointment.person_id)),
  ];

  const [{ data: people }, { data: projects }] = await Promise.all([
    memberIds.length
      ? supabase.from("people").select("id, full_name").in("id", memberIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    orgIds.length
      ? supabase
          .from("projects")
          .select("id, name, organization_id, health, status, target_date")
          .in("organization_id", orgIds)
          .eq("is_active", true)
      : Promise.resolve({
          data: [] as {
            id: string;
            name: string;
            organization_id: string;
            health: string;
            status: string;
            target_date: string | null;
          }[],
        }),
  ]);

  const projectIds = (projects ?? []).map((project) => project.id);

  const [
    { data: tasks },
    { data: activeTimers },
    { data: attendance },
    { data: workstreams },
  ] = await Promise.all([
      projectIds.length
        ? supabase
            .from("tasks")
            .select(
              "id, title, project_id, workstream_id, assignee_person_id, reviewer_person_id, approver_person_id, current_holder_person_id, status, priority, deadline, is_blocked",
            )
            .in("project_id", projectIds)
            .in("status", ACTIVE_TASK_STATUSES)
        : Promise.resolve({
            data: [] as {
              id: string;
              title: string;
              project_id: string;
              workstream_id: string | null;
              assignee_person_id: string;
              reviewer_person_id: string | null;
              approver_person_id: string | null;
              current_holder_person_id: string | null;
              status: (typeof ACTIVE_TASK_STATUSES)[number];
              priority: string;
              deadline: string | null;
              is_blocked: boolean;
            }[],
          }),
      memberIds.length
        ? supabase
            .from("task_time_entries")
            .select("person_id, task_id, started_at")
            .in("person_id", memberIds)
            .is("ended_at", null)
        : Promise.resolve({
            data: [] as { person_id: string; task_id: string; started_at: string }[],
          }),
      memberIds.length
        ? supabase
            .from("attendance_sessions")
            .select("person_id, clock_in_at")
            .in("person_id", memberIds)
            .is("clock_out_at", null)
        : Promise.resolve({
            data: [] as { person_id: string; clock_in_at: string }[],
          }),
      projectIds.length
        ? supabase
            .from("workstreams")
            .select("id, project_id, name")
            .in("project_id", projectIds)
            .eq("is_active", true)
        : Promise.resolve({
            data: [] as { id: string; project_id: string; name: string }[],
          }),
    ]);

  const nowIso = new Date().toISOString();
  const nameById = new Map((people ?? []).map((person) => [person.id, person.full_name]));
  const projectNameById = new Map((projects ?? []).map((project) => [project.id, project.name]));
  const activeTimerByPerson = new Map((activeTimers ?? []).map((timer) => [timer.person_id, timer]));
  const attendanceByPerson = new Map((attendance ?? []).map((session) => [session.person_id, session]));

  const backlogByPerson = new Map<string, number>();
  const p1ByPerson = new Map<string, number>();
  const overdueByPerson = new Map<string, number>();
  const blockedByPerson = new Map<string, number>();

  for (const task of tasks ?? []) {
    backlogByPerson.set(
      task.assignee_person_id,
      (backlogByPerson.get(task.assignee_person_id) ?? 0) + 1,
    );
    if (task.priority === "P1") {
      p1ByPerson.set(task.assignee_person_id, (p1ByPerson.get(task.assignee_person_id) ?? 0) + 1);
    }
    if (task.deadline && task.deadline < nowIso) {
      overdueByPerson.set(
        task.assignee_person_id,
        (overdueByPerson.get(task.assignee_person_id) ?? 0) + 1,
      );
    }
    if (task.is_blocked) {
      blockedByPerson.set(
        task.assignee_person_id,
        (blockedByPerson.get(task.assignee_person_id) ?? 0) + 1,
      );
    }
  }

  const reviewQueue = (tasks ?? []).filter((task) =>
    ["SUBMITTED", "IN_REVIEW", "RESUBMITTED", "PENDING_APPROVAL"].includes(task.status),
  );

  const positionById = new Map((positions ?? []).map((position) => [position.id, position]));
  const unitById = new Map((units ?? []).map((unit) => [unit.id, unit]));
  const personOrgIds = new Map<string, Set<string>>();
  for (const appointment of appointments ?? []) {
    const position = positionById.get(appointment.position_id);
    const unit = position ? unitById.get(position.unit_id) : null;
    if (!unit) continue;
    const set = personOrgIds.get(appointment.person_id) ?? new Set<string>();
    set.add(unit.organization_id);
    personOrgIds.set(appointment.person_id, set);
  }

  const projectCompletenessIssueCount = new Map<string, number>();
  for (const project of projects ?? []) {
    const projectTasks = (tasks ?? []).filter((task) => task.project_id === project.id);
    const activeProjectTasks = projectTasks.filter((task) => task.status !== "CANCELLED");
    const projectWorkstreams = (workstreams ?? []).filter(
      (workstream) => workstream.project_id === project.id,
    );

    let issues = project.target_date ? 0 : 1;
    issues += activeProjectTasks.filter((task) => !task.deadline).length;
    issues += activeProjectTasks.filter((task) => !task.reviewer_person_id).length;
    issues += projectWorkstreams.filter(
      (workstream) =>
        !activeProjectTasks.some((task) => task.workstream_id === workstream.id),
    ).length;

    projectCompletenessIssueCount.set(project.id, issues);
  }

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm text-slate-500">พื้นที่หัวหน้าฝ่าย</p>
        <h1 className="mt-1 text-2xl font-semibold">ดูทีมและงานที่ต้องจัดการ</h1>
        <p className="mt-1 text-sm text-slate-500">
          แสดงเฉพาะองค์กรที่คุณได้รับบทบาทหัวหน้าฝ่าย
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">สมาชิก</div>
          <div className="mt-2 text-2xl font-semibold">{memberIds.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Clock In อยู่</div>
          <div className="mt-2 text-2xl font-semibold">{attendanceByPerson.size}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">กำลังจับเวลางาน</div>
          <div className="mt-2 text-2xl font-semibold text-emerald-700">
            {activeTimerByPerson.size}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">งานเปิดอยู่</div>
          <div className="mt-2 text-2xl font-semibold">{(tasks ?? []).length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">รอตรวจ/อนุมัติ</div>
          <div className="mt-2 text-2xl font-semibold">{reviewQueue.length}</div>
        </div>
      </section>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-4">
          <h2 className="font-semibold">สมาชิกและภาระงาน</h2>
          <p className="text-xs text-slate-500">
            เห็นงานค้าง P1 เกินกำหนด ติดขัด และสถานะการทำงานปัจจุบัน
          </p>
        </div>
        <table className="min-w-[920px] w-full text-left text-sm">
          <thead>
            <tr className="text-slate-400">
              <th className="px-4 py-2">สมาชิก</th>
              <th className="px-4 py-2">สถานะวันนี้</th>
              <th className="px-4 py-2">งานค้าง</th>
              <th className="px-4 py-2">P1</th>
              <th className="px-4 py-2">เกินกำหนด</th>
              <th className="px-4 py-2">ติดขัด</th>
              <th className="px-4 py-2">กำลังทำ</th>
            </tr>
          </thead>
          <tbody>
            {memberIds.map((personId) => {
              const session = attendanceByPerson.get(personId);
              const timer = activeTimerByPerson.get(personId);
              const timerTask = timer
                ? (tasks ?? []).find((task) => task.id === timer.task_id)
                : null;

              return (
                <tr key={personId} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{nameById.get(personId) ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {session ? `เข้างาน ${formatThaiDateTime(session.clock_in_at)}` : "ยังไม่ Clock In"}
                  </td>
                  <td className="px-4 py-3">{backlogByPerson.get(personId) ?? 0}</td>
                  <td className="px-4 py-3">{p1ByPerson.get(personId) ?? 0}</td>
                  <td className="px-4 py-3 text-red-600">{overdueByPerson.get(personId) ?? 0}</td>
                  <td className="px-4 py-3 text-amber-700">{blockedByPerson.get(personId) ?? 0}</td>
                  <td className="px-4 py-3">
                    {timerTask ? (
                      <Link href={`/tasks/${timerTask.id}`} className="hover:underline">
                        {timerTask.title}
                      </Link>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {memberIds.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  ยังไม่มีสมาชิกที่มีตำแหน่งปัจจุบันในองค์กรนี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3">
          <h2 className="font-semibold">จัดผู้รับผิดชอบ / ผู้ตรวจ / ผู้อนุมัติ</h2>
          <p className="text-xs text-slate-500">
            ใช้สำหรับจัดงานขององค์กรที่คุณดูแลเท่านั้น ระบบจะตรวจสิทธิ์และสมาชิกขององค์กรอีกครั้งก่อนบันทึก
          </p>
        </div>
        <div className="space-y-3">
          {(tasks ?? []).slice(0, 12).map((task) => (
            <div key={task.id} className="rounded-lg border border-slate-100 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link href={`/tasks/${task.id}`} className="text-sm font-medium hover:underline">
                    {task.title}
                  </Link>
                  <div className="mt-1 text-xs text-slate-400">
                    {projectNameById.get(task.project_id) ?? "-"} · {TASK_STATUS_LABELS[task.status]}
                  </div>
                </div>
                <span className="rounded bg-slate-100 px-2 py-1 text-xs">{task.priority}</span>
              </div>
              <TaskPeopleForm
                taskId={task.id}
                people={(people ?? [])
                  .filter((person) => {
                    const project = (projects ?? []).find((item) => item.id === task.project_id);
                    return project
                      ? personOrgIds.get(person.id)?.has(project.organization_id)
                      : false;
                  })
                  .map((person) => ({ id: person.id, name: person.full_name }))}
                assigneePersonId={task.assignee_person_id}
                reviewerPersonId={task.reviewer_person_id}
                approverPersonId={task.approver_person_id}
              />
            </div>
          ))}
          {(tasks ?? []).length === 0 && (
            <p className="py-5 text-center text-sm text-slate-400">ยังไม่มีงานให้จัดการ</p>
          )}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">งานรอตรวจ / รออนุมัติ</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {reviewQueue.slice(0, 12).map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="block py-3 hover:bg-slate-50"
              >
                <div className="text-sm font-medium">{task.title}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {projectNameById.get(task.project_id) ?? "-"} · {TASK_STATUS_LABELS[task.status]}
                </div>
              </Link>
            ))}
            {reviewQueue.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">ไม่มีงานค้างตรวจ</p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">โครงการในความรับผิดชอบ</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {(projects ?? []).map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50"
              >
                <div>
                  <div className="text-sm font-medium">{project.name}</div>
                  <div className="mt-1 text-xs text-slate-400">{project.status}</div>
                  <div
                    className={
                      "mt-1 text-xs " +
                      ((projectCompletenessIssueCount.get(project.id) ?? 0) === 0
                        ? "text-emerald-600"
                        : "text-amber-600")
                    }
                  >
                    {(projectCompletenessIssueCount.get(project.id) ?? 0) === 0
                      ? "ข้อมูลโครงการครบตามเกณฑ์พื้นฐาน"
                      : "มี " +
                        (projectCompletenessIssueCount.get(project.id) ?? 0) +
                        " จุดที่ต้องเติม"}
                  </div>
                </div>
                <span className="text-xs text-slate-500">{project.health}</span>
              </Link>
            ))}
            {(projects ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">ยังไม่มีโครงการ</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
