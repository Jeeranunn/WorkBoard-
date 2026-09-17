export interface CompletenessIssue {
  severity: "error" | "warning";
  message: string;
}

interface TaskLike {
  id: string;
  workstream_id: string | null;
  deadline: string | null;
  reviewer_person_id: string | null;
  status: string;
  source_playbook_task_id: string | null;
}

interface WorkstreamLike {
  id: string;
  name: string;
}

interface ConditionalRuleLike {
  if_tag: string;
  then_tag: string;
  message: string;
}

// Checks project planning gaps without forcing every project into a Playbook.
// Manual/ad-hoc projects may have no workstreams and manual tasks do not
// require a reviewer by default. Reviewer requirements apply only to tasks
// whose Playbook template explicitly marks requires_reviewer=true.
export function checkProjectCompleteness(params: {
  project: { target_date: string | null };
  workstreams: WorkstreamLike[];
  tasks: TaskLike[];
  taskTagById: Map<string, string>;
  conditionalRules: ConditionalRuleLike[];
  reviewRequiredTaskIds?: Set<string>;
}): CompletenessIssue[] {
  const issues: CompletenessIssue[] = [];

  if (!params.project.target_date) {
    issues.push({
      severity: "warning",
      message: "โครงการยังไม่มีกำหนดวันสิ้นสุด (target date)",
    });
  }

  const activeTasks = params.tasks.filter((t) => t.status !== "CANCELLED");

  for (const ws of params.workstreams) {
    const hasTask = activeTasks.some((t) => t.workstream_id === ws.id);
    if (!hasTask) {
      issues.push({
        severity: "warning",
        message: `กลุ่มงาน "${ws.name}" ยังไม่มีงาน`,
      });
    }
  }

  const missingDeadline = activeTasks.filter((t) => !t.deadline).length;
  if (missingDeadline > 0) {
    issues.push({
      severity: "warning",
      message: `มี ${missingDeadline} งานที่ยังไม่มีกำหนดส่ง`,
    });
  }

  const reviewRequiredTaskIds = params.reviewRequiredTaskIds ?? new Set<string>();
  const missingReviewer = activeTasks.filter(
    (t) => reviewRequiredTaskIds.has(t.id) && !t.reviewer_person_id,
  ).length;
  if (missingReviewer > 0) {
    issues.push({
      severity: "warning",
      message: `มี ${missingReviewer} งานจากร่างมาตรฐานที่กำหนดให้มีผู้ตรวจ แต่ยังไม่ได้ระบุผู้ตรวจ`,
    });
  }

  const presentTags = new Set(
    activeTasks
      .map((t) =>
        t.source_playbook_task_id
          ? params.taskTagById.get(t.source_playbook_task_id)
          : undefined,
      )
      .filter((tag): tag is string => Boolean(tag)),
  );

  for (const rule of params.conditionalRules) {
    if (presentTags.has(rule.if_tag) && !presentTags.has(rule.then_tag)) {
      issues.push({ severity: "error", message: rule.message });
    }
  }

  return issues;
}
