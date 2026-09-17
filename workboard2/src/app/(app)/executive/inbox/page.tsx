import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { ExecutiveInboxTabs } from "@/components/executive/executive-inbox-tabs";

const TAB_LIMIT = 20;

export default async function ExecutiveInboxPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isAdmin = hasRole(user, "ADMIN");
  const isExecutive = hasRole(user, "EXECUTIVE");
  if (!isAdmin && !isExecutive) {
    redirect("/overview");
  }

  const supabase = await createClient();
  const mine = `recipient_person_id.is.null,recipient_person_id.eq.${user.personId}`;

  // Round 1: three queries, each scoped to this executive's own inbox, none
  // depending on the others.
  const [
    { data: openQuestions },
    { data: inFlightMeetings },
    { data: memoRecipientRows },
  ] = await Promise.all([
    supabase
      .from("executive_questions")
      .select("id, sender_person_id, question, created_at")
      .eq("status", "OPEN")
      .or(mine)
      .order("created_at", { ascending: true })
      .limit(TAB_LIMIT),
    supabase
      .from("meeting_requests")
      .select(
        "id, sender_person_id, topic, requested_start, duration_minutes, location, status",
      )
      .in("status", ["PENDING", "RESCHEDULE_PROPOSED"])
      .or(mine)
      .order("requested_start", { ascending: true })
      .limit(TAB_LIMIT),
    supabase
      .from("management_memo_recipients")
      .select("memo_id, acknowledged_at")
      .eq("recipient_person_id", user.personId),
  ]);

  const memoIds = (memoRecipientRows ?? []).map((r) => r.memo_id);
  const qmSenderIds = [
    ...new Set([
      ...(openQuestions ?? []).map((q) => q.sender_person_id),
      ...(inFlightMeetings ?? []).map((m) => m.sender_person_id),
    ]),
  ];

  // Round 2: recent memos addressed to this executive, and sender names for
  // the questions/meetings from round 1 — independent of each other.
  const [{ data: memos }, { data: qmSenders }] = await Promise.all([
    memoIds.length
      ? supabase
          .from("management_memos")
          .select("id, sender_person_id, subject, body, link, created_at")
          .in("id", memoIds)
          .order("created_at", { ascending: false })
          .limit(TAB_LIMIT)
      : Promise.resolve({
          data: [] as {
            id: string;
            sender_person_id: string;
            subject: string;
            body: string | null;
            link: string | null;
            created_at: string;
          }[],
        }),
    qmSenderIds.length
      ? supabase.from("people").select("id, full_name").in("id", qmSenderIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const memoSenderIds = [...new Set((memos ?? []).map((m) => m.sender_person_id))];

  // Round 3: sender names for the memos fetched in round 2 (not knowable any
  // earlier, since it depends on which memos exist).
  const { data: memoSenders } = memoSenderIds.length
    ? await supabase.from("people").select("id, full_name").in("id", memoSenderIds)
    : { data: [] as { id: string; full_name: string }[] };

  const nameById = new Map<string, string>();
  for (const p of qmSenders ?? []) nameById.set(p.id, p.full_name);
  for (const p of memoSenders ?? []) nameById.set(p.id, p.full_name);

  const ackByMemo = new Map(
    (memoRecipientRows ?? []).map((r) => [r.memo_id, r.acknowledged_at]),
  );

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-slate-500">พื้นที่ผู้บริหาร</p>
        <h1 className="mt-1 text-2xl font-semibold">กล่องข้อความ</h1>
        <p className="mt-1 text-sm text-slate-500">
          คำถามที่รอตอบ คำขอนัดหมาย และบันทึกข้อความจากหัวหน้าฝ่าย
        </p>
      </header>

      <ExecutiveInboxTabs
        questions={(openQuestions ?? []).map((q) => ({
          id: q.id,
          question: q.question,
          senderName: nameById.get(q.sender_person_id) ?? "-",
          createdAt: q.created_at,
        }))}
        meetings={(inFlightMeetings ?? []).map((m) => ({
          id: m.id,
          topic: m.topic,
          requestedStart: m.requested_start,
          durationMinutes: m.duration_minutes,
          location: m.location,
          // The query above already filters to these two statuses; the
          // client only narrows the column type, not the value.
          status: m.status as "PENDING" | "RESCHEDULE_PROPOSED",
          senderName: nameById.get(m.sender_person_id) ?? "-",
        }))}
        memos={(memos ?? []).map((m) => ({
          id: m.id,
          subject: m.subject,
          body: m.body,
          link: m.link,
          createdAt: m.created_at,
          senderName: nameById.get(m.sender_person_id) ?? "-",
          acknowledgedAt: ackByMemo.get(m.id) ?? null,
        }))}
      />
    </div>
  );
}
