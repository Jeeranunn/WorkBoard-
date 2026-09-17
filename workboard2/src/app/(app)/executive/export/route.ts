import { getCurrentUser, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function csvCell(value: string | number | boolean | null | undefined): string {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (!hasRole(user, "ADMIN") && !hasRole(user, "EXECUTIVE"))) {
    return new Response("ไม่มีสิทธิ์เข้าถึงรายงานนี้", { status: 403 });
  }

  const supabase = await createClient();
  const [{ data: projects, error: projectError }, { data: tasks, error: taskError }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, name, organization_id, status, health, target_date")
        .order("name"),
      supabase
        .from("tasks")
        .select(
          "id, project_id, title, status, priority, deadline, is_blocked, is_waiting, is_on_hold, assignee_person_id, reviewer_person_id, approver_person_id, current_holder_person_id",
        )
        .order("deadline", { ascending: true, nullsFirst: false }),
    ]);

  if (projectError || taskError) {
    return new Response("ไม่สามารถสร้างรายงานได้", { status: 500 });
  }

  const projectName = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const rows = [
    [
      "Project",
      "Task",
      "Status",
      "Priority",
      "Deadline",
      "Blocked",
      "Waiting",
      "On Hold",
      "Assignee Person ID",
      "Reviewer Person ID",
      "Approver Person ID",
      "Current Holder Person ID",
    ],
    ...(tasks ?? []).map((task) => [
      projectName.get(task.project_id) ?? "",
      task.title,
      task.status,
      task.priority,
      task.deadline ?? "",
      task.is_blocked,
      task.is_waiting,
      task.is_on_hold,
      task.assignee_person_id,
      task.reviewer_person_id ?? "",
      task.approver_person_id ?? "",
      task.current_holder_person_id ?? "",
    ]),
  ];

  const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="workboard-executive-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
