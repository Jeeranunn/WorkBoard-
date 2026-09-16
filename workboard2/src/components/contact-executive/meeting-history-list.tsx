import { formatThaiDateTime } from "@/lib/date-time";
import { MEETING_STATUS_LABELS, MEETING_STATUS_STYLES } from "@/lib/comm-labels";
import { SimpleActionButton } from "@/components/forms/simple-action-button";
import {
  confirmMeetingRescheduleAction,
  cancelMeetingRequestAction,
} from "@/app/(app)/contact-executive/actions";

export interface MeetingHistoryRow {
  id: string;
  topic: string;
  requestedStart: string;
  durationMinutes: number;
  location: string | null;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "RESCHEDULE_PROPOSED" | "CANCELLED";
  executiveRemark: string | null;
  proposedStart: string | null;
  proposedLocation: string | null;
  recipientName: string;
}

export function MeetingHistoryList({
  meetings,
}: {
  meetings: MeetingHistoryRow[];
}) {
  return (
    <div className="mt-3 divide-y divide-slate-100">
      {meetings.map((m) => (
        <div key={m.id} className="py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{m.topic}</p>
              <p className="mt-1 text-xs text-slate-400">
                {formatThaiDateTime(m.requestedStart)} · {m.durationMinutes} นาที
                {m.location ? ` · ${m.location}` : ""}
              </p>
              <p className="text-xs text-slate-400">ถึง {m.recipientName}</p>
            </div>
            <span
              className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${MEETING_STATUS_STYLES[m.status]}`}
            >
              {MEETING_STATUS_LABELS[m.status]}
            </span>
          </div>

          {m.status === "RESCHEDULE_PROPOSED" && m.proposedStart && (
            <div className="mt-2 rounded-lg bg-sky-50 p-3 text-sm">
              <p>
                ผู้บริหารเสนอเวลาใหม่: {formatThaiDateTime(m.proposedStart)}
                {m.proposedLocation ? ` · ${m.proposedLocation}` : ""}
              </p>
              {m.executiveRemark && (
                <p className="mt-1 text-xs text-slate-500">{m.executiveRemark}</p>
              )}
              <div className="mt-2 flex gap-2">
                <SimpleActionButton
                  action={confirmMeetingRescheduleAction}
                  hiddenFields={{ request_id: m.id }}
                  label="ยืนยันเวลาใหม่"
                  className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
                />
                <SimpleActionButton
                  action={cancelMeetingRequestAction}
                  hiddenFields={{ request_id: m.id }}
                  label="ยกเลิก"
                  confirmMessage="ยืนยันยกเลิกคำขอนัดหมายนี้?"
                />
              </div>
            </div>
          )}

          {m.status === "DECLINED" && m.executiveRemark && (
            <p className="mt-2 text-xs text-slate-500">เหตุผล: {m.executiveRemark}</p>
          )}

          {m.status === "PENDING" && (
            <div className="mt-2">
              <SimpleActionButton
                action={cancelMeetingRequestAction}
                hiddenFields={{ request_id: m.id }}
                label="ยกเลิกคำขอ"
                confirmMessage="ยืนยันยกเลิกคำขอนัดหมายนี้?"
              />
            </div>
          )}
        </div>
      ))}
      {meetings.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-400">
          ยังไม่มีคำขอนัดหมาย
        </p>
      )}
    </div>
  );
}
