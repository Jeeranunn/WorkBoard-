import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole, hasRoleInOrganization } from "@/lib/auth";
import { TASK_STATUS_LABELS, WORK_ORIGIN_LABELS } from "@/lib/task-labels";
import type { PriorityLevel } from "@/lib/database.types";
import { TimerActionForm } from "@/components/tasks/timer-action-form";
import { WorkflowActionForm } from "@/components/tasks/workflow-action-form";
import { TaskCommentForm } from "@/components/tasks/comment-form";
import { ElapsedTime, LiveElapsedTime } from "@/components/time/live-elapsed-time";
import { formatThaiDateTime } from "@/lib/date-time";
import {
  acknowledgeTaskAction,
  startTaskAction,
  submitTaskAction,
  beginReviewAction,
  requestRevisionAction,
  resubmitTaskAction,
  submitForApprovalAction,
  approveTaskAction,
  completeTaskAction,
  startTaskTimerAction,
  switchTaskTimerAction,
  pauseTaskTimerAction,
} from "../actions";

const PRIORITY_STYLES: Record<PriorityLevel, string> = {
  P1: "bg-red-100 text-red-700",
  P2: "bg-amber-100 text-amber-700",
  P3: "bg-sky-100 text-sky-700",
  P4: "bg-slate-100 text-slate-600",
};

const HISTORY_FIELD_LABELS: Record<string, string> = {
  status: "สถานะ",
  assignee_person_id: "ผู้รับผิดชอบ",
  reviewer_person_id: "ผู้ตรวจ",
  approver_person_id: "ผู้อนุมัติ",
  deadline: "กำหนดส่ง",
};

const PERSON_FIELDS = new Set([
  "assignee_person_id",
  "reviewer_person_id",
  "approver_person_id",
]);

export default async function TaskDetailPage(
  props: PageProps<"/tasks/[taskId]">,
) {
  const { taskId } = await props.params;

  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();

  // myActiveTimer doesn't depend on `task` at all (it's just "does this
  // person have any timer running anywhere"), so it's fetched alongside the
  // task instead of after everything else — one fewer sequential round trip.
  const [{ data: task }, { data: myActiveTimer }] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, project_id, workstream_id, milestone_id, title, description, deliverable, completion_criteria, source, work_origin, status, assignee_person_id, reviewer_person_id, approver_person_id, current_holder_person_id, deadline, priority, is_blocked, blocked_reason, is_waiting, waiting_reason, is_on_hold, on_hold_reason",
      )
      .eq("id", taskId)
      .maybeSingle(),
    supabase
      .from("task_time_entries")
      .select("id, task_id, started_at")
      .eq("person_id", user.personId)
      .is("ended_at", null)
      .maybeSingle(),
  ]);

  if (!task) notFound();

  const [
    { data: project },
    { data: workstream },
    { data: milestone },
    { data: collaboratorRows },
    { data: predecessorLinks },
    { data: successorLinks },
    { data: submissions },
    { data: comments },
    { data: history },
    { data: taskTimeEntries },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, organization_id")
      .eq("id", task.project_id)
      .single(),
    task.workstream_id
      ? supabase
          .from("workstreams")
          .select("id, name")
          .eq("id", task.workstream_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    task.milestone_id
      ? supabase
          .from("milestones")
          .select("id, name")
          .eq("id", task.milestone_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("task_collaborators").select("person_id").eq("task_id", taskId),
    supabase
      .from("task_dependencies")
      .select("predecessor_task_id")
      .eq("successor_task_id", taskId),
    supabase
      .from("task_dependencies")
      .select("successor_task_id")
      .eq("predecessor_task_id", taskId),
    supabase
      .from("task_submissions")
      .select("id, version, message, link, submitted_by_person_id, submitted_at")
      .eq("task_id", taskId)
      .order("version", { ascending: false }),
    supabase
      .from("task_comments")
      .select("id, author_person_id, body, is_question, created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true }),
    supabase
      .from("task_history")
      .select("id, changed_by_person_id, field_name, old_value, new_value, changed_at")
      .eq("task_id", taskId)
      .order("changed_at", { ascending: true }),
    supabase
      .from("task_time_entries")
      .select("id, person_id, started_at, ended_at, source")
      .eq("task_id", taskId)
      .order("started_at", { ascending: true }),
  ]);

  if (!project) notFound();

  const predecessorIds = (predecessorLinks ?? []).map((l) => l.predecessor_task_id);
  const successorIds = (successorLinks ?? []).map((l) => l.successor_task_id);

  const [{ data: predecessorTasks }, { data: successorTasks }] = await Promise.all([
    predecessorIds.length
      ? supabase.from("tasks").select("id, title, status").in("id", predecessorIds)
      : Promise.resolve({ data: [] as { id: string; title: string; status: string }[] }),
    successorIds.length
      ? supabase.from("tasks").select("id, title, status").in("id", successorIds)
      : Promise.resolve({ data: [] as { id: string; title: string; status: string }[] }),
  ]);

  const personIds = new Set<string>();
  [
    task.assignee_person_id,
    task.reviewer_person_id,
    task.approver_person_id,
    task.current_holder_person_id,
  ].forEach((id) => id && personIds.add(id));
  (collaboratorRows ?? []).forEach((c) => personIds.add(c.person_id));
  (submissions ?? []).forEach((s) => personIds.add(s.submitted_by_person_id));
  (comments ?? []).forEach((c) => personIds.add(c.author_person_id));
  (history ?? []).forEach((h) => {
    if (h.changed_by_person_id) personIds.add(h.changed_by_person_id);
    if (PERSON_FIELDS.has(h.field_name)) {
      if (h.old_value) personIds.add(h.old_value);
      if (h.new_value) personIds.add(h.new_value);
    }
  });

  const { data: peopleRows } = personIds.size
    ? await supabase
        .from("people")
        .select("id, full_name")
        .in("id", [...personIds])
    : { data: [] as { id: string; full_name: string }[] };

  const nameById = new Map((peopleRows ?? []).map((p) => [p.id, p.full_name]));
  const name = (id: string | null) => (id ? (nameById.get(id) ?? "-") : "-");

  const closedTaskSeconds = (taskTimeEntries ?? []).reduce((sum, entry) => {
    if (!entry.ended_at) return sum;
    return (
      sum +
      Math.max(
        0,
        Math.floor(
          (new Date(entry.ended_at).getTime() -
            new Date(entry.started_at).getTime()) /
            1000,
        ),
      )
    );
  }, 0);
  const activeTaskTimeEntry =
    (taskTimeEntries ?? []).find((entry) => !entry.ended_at) ?? null;

  const isAssigneeSide =
    hasRole(user, "ADMIN") ||
    task.assignee_person_id === user.personId ||
    hasRoleInOrganization(user, "HEAD", project.organization_id);
  const canTrackOwnTime = task.assignee_person_id === user.personId;

  const isHolderSide =
    hasRole(user, "ADMIN") ||
    task.current_holder_person_id === user.personId ||
    hasRoleInOrganization(user, "HEAD", project.organization_id);

  interface ActivityItem {
    at: string;
    node: React.ReactNode;
  }

  const activity: ActivityItem[] = [];

  for (const h of history ?? []) {
    const label = HISTORY_FIELD_LABELS[h.field_name] ?? h.field_name;
    const from = PERSON_FIELDS.has(h.field_name)
      ? name(h.old_value)
      : h.field_name === "deadline"
        ? formatThaiDateTime(h.old_value)
        : h.field_name === "status"
          ? (TASK_STATUS_LABELS[h.old_value as keyof typeof TASK_STATUS_LABELS] ?? h.old_value ?? "-")
          : (h.old_value ?? "-");
    const to = PERSON_FIELDS.has(h.field_name)
      ? name(h.new_value)
      : h.field_name === "deadline"
        ? formatThaiDateTime(h.new_value)
        : h.field_name === "status"
          ? (TASK_STATUS_LABELS[h.new_value as keyof typeof TASK_STATUS_LABELS] ?? h.new_value ?? "-")
          : (h.new_value ?? "-");
    activity.push({
      at: h.changed_at,
      node: (
        <p>
          <span className="font-medium">{name(h.changed_by_person_id)}</span>{" "}
          เปลี่ยน{label}จาก &ldquo;{from}&rdquo; เป็น &ldquo;{to}&rdquo;
        </p>
      ),
    });
  }

  for (const c of comments ?? []) {
    activity.push({
      at: c.created_at,
      node: (
        <p>
          <span className="font-medium">{name(c.author_person_id)}</span>
          {c.is_question && (
            <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-700">
              คำถาม
            </span>
          )}
          : {c.body}
        </p>
      ),
    });
  }

  for (const s of submissions ?? []) {
    activity.push({
      at: s.submitted_at,
      node: (
        <p>
          <span className="font-medium">{name(s.submitted_by_person_id)}</span>{" "}
          ส่งงาน (เวอร์ชัน {s.version}) {s.message && `— ${s.message}`}{" "}
          {s.link && (
            <a
              href={s.link}
              className="text-sky-600 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              ลิงก์ผลงาน
            </a>
          )}
        </p>
      ),
    });
  }

  activity.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-slate-400">
          {project.name}
          {workstream && ` / ${workstream.name}`}
          {milestone && ` / ${milestone.name}`}
        </div>
        <h1 className="text-xl font-semibold">{task.title}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded px-1.5 py-0.5 font-medium ${PRIORITY_STYLES[task.priority]}`}
          >
            {task.priority}
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
            {TASK_STATUS_LABELS[task.status]}
          </span>
          <span className="text-slate-400">
            {WORK_ORIGIN_LABELS[task.work_origin]}
          </span>
          {task.is_blocked && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">
              ติดขัด{task.blocked_reason ? `: ${task.blocked_reason}` : ""}
            </span>
          )}
          {task.is_waiting && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
              รอ{task.waiting_reason ? `: ${task.waiting_reason}` : ""}
            </span>
          )}
          {task.is_on_hold && (
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-700">
              พักไว้{task.on_hold_reason ? `: ${task.on_hold_reason}` : ""}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold">รายละเอียด</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-600">
              {task.description || "-"}
            </p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-400">Deliverable</dt>
                <dd>{task.deliverable || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">เกณฑ์ความสำเร็จ</dt>
                <dd>{task.completion_criteria || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">กำหนดส่ง</dt>
                <dd>{formatThaiDateTime(task.deadline)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">ที่มา</dt>
                <dd>{task.source || "-"}</dd>
              </div>
            </dl>
          </section>

          {/* Workflow actions */}
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold">การดำเนินการ</h2>
            <div className="flex flex-wrap gap-2">
              {task.status === "ASSIGNED" && isAssigneeSide && (
                <WorkflowActionForm action={acknowledgeTaskAction} taskId={task.id}>
                  <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white">
                    รับทราบงาน
                  </button>
                </WorkflowActionForm>
              )}
              {task.status === "ACKNOWLEDGED" && isAssigneeSide && (
                <WorkflowActionForm action={startTaskAction} taskId={task.id}>
                  <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white">
                    เริ่มทำงาน
                  </button>
                </WorkflowActionForm>
              )}
              {(task.status === "SUBMITTED" || task.status === "RESUBMITTED") &&
                isHolderSide && (
                  <WorkflowActionForm action={beginReviewAction} taskId={task.id}>
                    <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white">
                      เริ่มตรวจงาน
                    </button>
                  </WorkflowActionForm>
                )}
              {task.status === "IN_REVIEW" &&
                isHolderSide &&
                (task.approver_person_id ? (
                  <WorkflowActionForm action={submitForApprovalAction} taskId={task.id}>
                    <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white">
                      ส่งต่อผู้อนุมัติ
                    </button>
                  </WorkflowActionForm>
                ) : (
                  <WorkflowActionForm action={approveTaskAction} taskId={task.id}>
                    <button className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white">
                      อนุมัติ
                    </button>
                  </WorkflowActionForm>
                ))}
              {task.status === "PENDING_APPROVAL" && isHolderSide && (
                <WorkflowActionForm action={approveTaskAction} taskId={task.id}>
                  <button className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white">
                    อนุมัติ
                  </button>
                </WorkflowActionForm>
              )}
              {task.status === "APPROVED" && isAssigneeSide && (
                <WorkflowActionForm action={completeTaskAction} taskId={task.id}>
                  <button className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white">
                    ปิดงาน
                  </button>
                </WorkflowActionForm>
              )}
            </div>

            {task.status === "IN_PROGRESS" && isAssigneeSide && (
              <WorkflowActionForm action={submitTaskAction} taskId={task.id} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                <label className="text-xs font-medium text-slate-500">ส่งงาน</label>
                <textarea
                  name="message"
                  placeholder="ข้อความตอนส่งงาน"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  rows={2}
                />
                <input
                  name="link"
                  placeholder="ลิงก์ผลงาน (ถ้ามี)"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
                <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white">
                  ส่งงาน
                </button>
              </WorkflowActionForm>
            )}

            {task.status === "REVISION_REQUIRED" && isAssigneeSide && (
              <WorkflowActionForm action={resubmitTaskAction} taskId={task.id} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                <label className="text-xs font-medium text-slate-500">ส่งงานใหม่</label>
                <textarea
                  name="message"
                  placeholder="ข้อความตอนส่งงานใหม่"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  rows={2}
                />
                <input
                  name="link"
                  placeholder="ลิงก์ผลงาน (ถ้ามี)"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
                <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white">
                  ส่งงานใหม่
                </button>
              </WorkflowActionForm>
            )}

            {task.status === "IN_REVIEW" && isHolderSide && (
              <WorkflowActionForm action={requestRevisionAction} taskId={task.id} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                <label className="text-xs font-medium text-slate-500">ขอให้แก้ไข</label>
                <textarea
                  name="note"
                  placeholder="ระบุสิ่งที่ต้องแก้ไข"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  rows={2}
                />
                <button className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700">
                  ขอให้แก้ไข
                </button>
              </WorkflowActionForm>
            )}

            {["COMPLETED", "CANCELLED"].includes(task.status) && (
              <p className="text-sm text-slate-400">งานนี้จบแล้ว ไม่มีการดำเนินการเพิ่มเติม</p>
            )}
          </section>

          {(taskTimeEntries ?? []).length > 0 || canTrackOwnTime ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold">เวลาในงานนี้</h2>
              <div className="mb-3 flex flex-wrap items-baseline gap-2">
                <span className="text-xs text-slate-500">เวลาสะสมทั้งหมด</span>
                {activeTaskTimeEntry ? (
                  <LiveElapsedTime
                    startedAt={activeTaskTimeEntry.started_at}
                    baseSeconds={closedTaskSeconds}
                    className="font-mono text-lg font-semibold tabular-nums"
                  />
                ) : (
                  <ElapsedTime
                    seconds={closedTaskSeconds}
                    className="font-mono text-lg font-semibold tabular-nums"
                  />
                )}
                {activeTaskTimeEntry && (
                  <span className="text-xs text-emerald-700">กำลังเดินอยู่</span>
                )}
              </div>

              {canTrackOwnTime && (
                <>
                  {myActiveTimer?.task_id === task.id ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-emerald-700">
                        เริ่มช่วงล่าสุด {formatThaiDateTime(myActiveTimer.started_at)}
                      </span>
                      <TimerActionForm
                        action={pauseTaskTimerAction}
                        taskId={task.id}
                        buttonLabel="หยุดชั่วคราว"
                        pendingLabel="กำลังหยุด..."
                        buttonClassName="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                      />
                    </div>
                  ) : myActiveTimer ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">กำลังจับเวลางานอื่นอยู่</span>
                      <TimerActionForm
                        action={switchTaskTimerAction}
                        taskId={task.id}
                        buttonLabel="สลับมาจับเวลางานนี้"
                        pendingLabel="กำลังสลับ..."
                        buttonClassName="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">
                        {closedTaskSeconds > 0
                          ? "หยุดจับเวลาอยู่ — เริ่มต่อได้จากเวลาสะสมเดิม"
                          : "ยังไม่ได้เริ่มจับเวลา"}
                      </span>
                      <TimerActionForm
                        action={startTaskTimerAction}
                        taskId={task.id}
                        buttonLabel={closedTaskSeconds > 0 ? "ทำงานต่อ" : "เริ่มจับเวลางานนี้"}
                        pendingLabel="กำลังเริ่ม..."
                        buttonClassName="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
                      />
                    </div>
                  )}
                </>
              )}
            </section>
          ) : null}

          {/* Activity feed */}
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold">กิจกรรม</h2>
            <div className="space-y-3 text-sm">
              {activity.length === 0 && (
                <p className="text-slate-400">ยังไม่มีความเคลื่อนไหว</p>
              )}
              {activity.map((item, i) => (
                <div key={i} className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
                  {item.node}
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatThaiDateTime(item.at)}
                  </p>
                </div>
              ))}
            </div>

            <TaskCommentForm taskId={task.id} />
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <h2 className="mb-3 text-sm font-semibold">ผู้เกี่ยวข้อง</h2>
            <dl className="space-y-2">
              <div>
                <dt className="text-xs text-slate-400">ผู้รับผิดชอบ</dt>
                <dd>{name(task.assignee_person_id)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">ผู้ตรวจ</dt>
                <dd>{name(task.reviewer_person_id)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">ผู้อนุมัติ</dt>
                <dd>{name(task.approver_person_id)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">ตอนนี้รออยู่ที่</dt>
                <dd>{task.current_holder_person_id ? name(task.current_holder_person_id) : "ไม่มี (จบงานแล้ว)"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">ผู้ร่วมงาน</dt>
                <dd>
                  {(collaboratorRows ?? []).length
                    ? (collaboratorRows ?? []).map((c) => name(c.person_id)).join(", ")
                    : "-"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <h2 className="mb-3 text-sm font-semibold">Dependency</h2>
            <div className="space-y-2">
              <div>
                <div className="text-xs text-slate-400">ต้องเสร็จก่อน</div>
                {(predecessorTasks ?? []).length === 0 && (
                  <p className="text-slate-400">ไม่มี</p>
                )}
                {(predecessorTasks ?? []).map((t) => (
                  <p key={t.id}>
                    {t.title} —{" "}
                    <span className="text-xs text-slate-400">
                      {TASK_STATUS_LABELS[t.status as keyof typeof TASK_STATUS_LABELS]}
                    </span>
                  </p>
                ))}
              </div>
              <div>
                <div className="text-xs text-slate-400">รองานนี้อยู่</div>
                {(successorTasks ?? []).length === 0 && (
                  <p className="text-slate-400">ไม่มี</p>
                )}
                {(successorTasks ?? []).map((t) => (
                  <p key={t.id}>
                    {t.title} —{" "}
                    <span className="text-xs text-slate-400">
                      {TASK_STATUS_LABELS[t.status as keyof typeof TASK_STATUS_LABELS]}
                    </span>
                  </p>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
