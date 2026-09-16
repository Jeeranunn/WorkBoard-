import { formatThaiDateTime } from "@/lib/date-time";
import Link from "next/link";
import type { PriorityLevel, TaskStatus } from "@/lib/database.types";
import { TASK_STATUS_LABELS } from "@/lib/task-labels";

export interface TaskListRow {
  id: string;
  title: string;
  projectName: string;
  deadline: string | null;
  priority: PriorityLevel;
  status: TaskStatus;
  currentHolderName: string | null;
  isCurrentHolderMe: boolean;
}

const PRIORITY_STYLES: Record<PriorityLevel, string> = {
  P1: "bg-red-100 text-red-700",
  P2: "bg-amber-100 text-amber-700",
  P3: "bg-sky-100 text-sky-700",
  P4: "bg-slate-100 text-slate-600",
};

export function TaskListSection({
  title,
  description,
  tasks,
}: {
  title: string;
  description?: string;
  tasks: TaskListRow[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold">
          {title} <span className="text-slate-400">({tasks.length})</span>
        </h2>
        {description && (
          <p className="text-xs text-slate-400">{description}</p>
        )}
      </div>
      <table className="w-full text-left text-sm">
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className="border-t border-slate-100">
              <td className="w-1/3 px-4 py-2">
                <Link
                  href={`/tasks/${t.id}`}
                  className="font-medium text-slate-900 hover:underline"
                >
                  {t.title}
                </Link>
                <div className="text-xs text-slate-400">{t.projectName}</div>
              </td>
              <td className="px-4 py-2 text-xs text-slate-500">
                {formatThaiDateTime(t.deadline)}
              </td>
              <td className="px-4 py-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-medium ${PRIORITY_STYLES[t.priority]}`}
                >
                  {t.priority}
                </span>
              </td>
              <td className="px-4 py-2 text-xs text-slate-600">
                {TASK_STATUS_LABELS[t.status]}
              </td>
              <td className="px-4 py-2 text-xs text-slate-500">
                {t.isCurrentHolderMe
                  ? "รอฉัน"
                  : (t.currentHolderName ?? "-")}
              </td>
            </tr>
          ))}
          {tasks.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-4 text-center text-slate-400">
                ไม่มีงาน
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
