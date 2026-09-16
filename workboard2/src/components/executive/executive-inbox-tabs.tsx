"use client";

import { useState } from "react";
import { formatThaiDateTime } from "@/lib/date-time";
import { PlannerActionForm } from "@/components/planner/action-form";
import { SimpleActionButton } from "@/components/forms/simple-action-button";
import {
  replyToQuestionAction,
  respondMeetingRequestAction,
  acknowledgeMemoAction,
} from "@/app/(app)/executive/inbox/actions";

interface QuestionItem {
  id: string;
  question: string;
  senderName: string;
  createdAt: string;
}

interface MeetingItem {
  id: string;
  topic: string;
  requestedStart: string;
  durationMinutes: number;
  location: string | null;
  status: "PENDING" | "RESCHEDULE_PROPOSED";
  senderName: string;
}

interface MemoItem {
  id: string;
  subject: string;
  body: string | null;
  link: string | null;
  createdAt: string;
  senderName: string;
  acknowledgedAt: string | null;
}

type Tab = "questions" | "meetings" | "memos";

export function ExecutiveInboxTabs({
  questions,
  meetings,
  memos,
}: {
  questions: QuestionItem[];
  meetings: MeetingItem[];
  memos: MemoItem[];
}) {
  const [tab, setTab] = useState<Tab>("questions");

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "questions", label: "คำถามที่รอตอบ", count: questions.length },
    { id: "meetings", label: "คำขอนัดหมาย", count: meetings.length },
    { id: "memos", label: "บันทึกจากหัวหน้าฝ่าย", count: memos.length },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex border-b border-slate-100">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              tab === t.id
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === "questions" && <QuestionsTab items={questions} />}
        {tab === "meetings" && <MeetingsTab items={meetings} />}
        {tab === "memos" && <MemosTab items={memos} />}
      </div>
    </div>
  );
}

function QuestionsTab({ items }: { items: QuestionItem[] }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">ไม่มีคำถามที่รอตอบ</p>;
  }
  return (
    <div className="divide-y divide-slate-100">
      {items.map((q) => (
        <div key={q.id} className="py-4 first:pt-0">
          <p className="text-sm">{q.question}</p>
          <p className="mt-1 text-xs text-slate-400">
            จาก {q.senderName} · {formatThaiDateTime(q.createdAt)}
          </p>
          <PlannerActionForm
            action={replyToQuestionAction}
            submitLabel="ส่งคำตอบ"
            pendingLabel="กำลังส่ง..."
            className="mt-2 space-y-2"
            buttonClassName="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <input type="hidden" name="question_id" value={q.id} />
            <textarea
              name="body"
              required
              rows={2}
              placeholder="พิมพ์คำตอบ..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </PlannerActionForm>
        </div>
      ))}
    </div>
  );
}

function MeetingsTab({ items }: { items: MeetingItem[] }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">ไม่มีคำขอนัดหมายที่รอดำเนินการ</p>;
  }
  return (
    <div className="divide-y divide-slate-100">
      {items.map((m) => (
        <div key={m.id} className="py-4 first:pt-0">
          <p className="text-sm font-medium">{m.topic}</p>
          <p className="mt-1 text-xs text-slate-400">
            จาก {m.senderName} · {formatThaiDateTime(m.requestedStart)} · {m.durationMinutes} นาที
            {m.location ? ` · ${m.location}` : ""}
          </p>
          {m.status === "PENDING" ? (
            <div className="mt-2 flex flex-wrap items-start gap-2">
              <SimpleActionButton
                action={respondMeetingRequestAction}
                hiddenFields={{ request_id: m.id, status: "ACCEPTED" }}
                label="ยืนยันนัดหมาย"
                className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
              />
              <SimpleActionButton
                action={respondMeetingRequestAction}
                hiddenFields={{ request_id: m.id, status: "DECLINED" }}
                label="ปฏิเสธ"
              />
              <RescheduleForm requestId={m.id} />
            </div>
          ) : (
            <p className="mt-2 text-xs text-amber-600">
              เสนอเวลาใหม่แล้ว — รอผู้ขอยืนยัน
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function RescheduleForm({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50"
      >
        เสนอเวลาใหม่
      </button>
    );
  }

  return (
    <PlannerActionForm
      action={respondMeetingRequestAction}
      submitLabel="ส่งเวลาที่เสนอ"
      pendingLabel="กำลังส่ง..."
      className="w-full space-y-2 rounded-lg bg-slate-50 p-3"
      buttonClassName="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
    >
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="status" value="RESCHEDULE_PROPOSED" />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="datetime-local"
          name="proposed_start"
          required
          className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
        />
        <input
          type="text"
          name="proposed_location"
          placeholder="สถานที่ (ถ้ามี)"
          className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
        />
      </div>
      <input
        type="text"
        name="remark"
        placeholder="หมายเหตุ (ถ้ามี)"
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
      />
    </PlannerActionForm>
  );
}

function MemosTab({ items }: { items: MemoItem[] }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">ยังไม่มีบันทึกข้อความ</p>;
  }
  return (
    <div className="divide-y divide-slate-100">
      {items.map((memo) => (
        <div key={memo.id} className="py-4 first:pt-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{memo.subject}</p>
              <p className="mt-1 text-xs text-slate-400">
                จาก {memo.senderName} · {formatThaiDateTime(memo.createdAt)}
              </p>
            </div>
            {memo.acknowledgedAt ? (
              <span className="shrink-0 rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                รับทราบแล้ว
              </span>
            ) : (
              <SimpleActionButton
                action={acknowledgeMemoAction}
                hiddenFields={{ memo_id: memo.id }}
                label="รับทราบ"
                className="shrink-0 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
              />
            )}
          </div>
          {memo.body && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{memo.body}</p>
          )}
          {memo.link && (
            <a
              href={memo.link}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-sm text-slate-900 underline"
            >
              ลิงก์แนบ
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
