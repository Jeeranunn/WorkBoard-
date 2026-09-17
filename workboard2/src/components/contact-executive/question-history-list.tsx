import { formatThaiDateTime } from "@/lib/date-time";
import { QUESTION_STATUS_LABELS, QUESTION_STATUS_STYLES } from "@/lib/comm-labels";
import { SimpleActionButton } from "@/components/forms/simple-action-button";
import { withdrawQuestionAction } from "@/app/(app)/contact-executive/actions";

export interface QuestionHistoryRow {
  id: string;
  question: string;
  status: "OPEN" | "ANSWERED" | "WITHDRAWN";
  recipientName: string;
  createdAt: string;
  replies: {
    id: string;
    body: string;
    authorName: string;
    createdAt: string;
  }[];
}

export function QuestionHistoryList({
  questions,
}: {
  questions: QuestionHistoryRow[];
}) {
  return (
    <div className="mt-3 divide-y divide-slate-100">
      {questions.map((q) => (
        <div key={q.id} className="py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm">{q.question}</p>
              <p className="mt-1 text-xs text-slate-400">
                ถึง {q.recipientName} · {formatThaiDateTime(q.createdAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`rounded px-2 py-1 text-xs font-medium ${QUESTION_STATUS_STYLES[q.status]}`}
              >
                {QUESTION_STATUS_LABELS[q.status]}
              </span>
              {q.status === "OPEN" && (
                <SimpleActionButton
                  action={withdrawQuestionAction}
                  hiddenFields={{ question_id: q.id }}
                  label="ถอนคำถาม"
                  confirmMessage="ยืนยันถอนคำถามนี้?"
                />
              )}
            </div>
          </div>
          {q.replies.length > 0 && (
            <div className="mt-2 space-y-2 border-l-2 border-slate-100 pl-3">
              {q.replies.map((reply) => (
                <div key={reply.id} className="text-sm">
                  <p className="text-slate-700">{reply.body}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {reply.authorName} · {formatThaiDateTime(reply.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {questions.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-400">
          ยังไม่มีคำถามที่ส่ง
        </p>
      )}
    </div>
  );
}
