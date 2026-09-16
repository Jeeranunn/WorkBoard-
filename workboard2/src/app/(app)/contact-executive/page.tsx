import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { SendQuestionForm } from "@/components/contact-executive/send-question-form";
import { CreateMeetingForm } from "@/components/contact-executive/create-meeting-form";
import { QuestionHistoryList } from "@/components/contact-executive/question-history-list";
import { MeetingHistoryList } from "@/components/contact-executive/meeting-history-list";

const HISTORY_LIMIT = 10;

export default async function ContactExecutivePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();

  // Round 1: three queries that only depend on the caller's own person_id —
  // none of them depends on the others, so they run together.
  const [
    { data: executiveIds },
    { data: myQuestions },
    { data: myMeetings },
  ] = await Promise.all([
    supabase.rpc("active_executive_people"),
    supabase
      .from("executive_questions")
      .select("id, question, status, recipient_person_id, created_at, withdrawn_at")
      .eq("sender_person_id", user.personId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase
      .from("meeting_requests")
      .select(
        "id, topic, requested_start, duration_minutes, location, status, executive_remark, proposed_start, proposed_location, recipient_person_id, created_at",
      )
      .eq("sender_person_id", user.personId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);

  const questionIds = (myQuestions ?? []).map((q) => q.id);

  // Every valid recipient_person_id on a question/meeting is, by
  // construction (see 0028's RPCs), one of the currently active executives —
  // so the executive list alone covers recipient names without a further
  // round trip. A reply authored by someone who has since left the
  // EXECUTIVE role is the one case this misses; that falls back to a
  // generic label below rather than paying for a third round trip.
  const peopleIds = [...new Set(executiveIds ?? [])];

  // Round 2: two queries, both only depending on round 1's results, and not
  // on each other.
  const [{ data: people }, { data: replies }] = await Promise.all([
    peopleIds.length
      ? supabase.from("people").select("id, full_name").in("id", peopleIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    questionIds.length
      ? supabase
          .from("executive_question_replies")
          .select("id, question_id, author_person_id, body, created_at")
          .in("question_id", questionIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({
          data: [] as {
            id: string;
            question_id: string;
            author_person_id: string;
            body: string;
            created_at: string;
          }[],
        }),
  ]);

  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const executives = (executiveIds ?? []).map((id) => ({
    id,
    fullName: nameById.get(id) ?? "ผู้บริหาร",
  }));

  const repliesByQuestion = new Map<string, typeof replies>();
  for (const reply of replies ?? []) {
    const list = repliesByQuestion.get(reply.question_id) ?? [];
    list.push(reply);
    repliesByQuestion.set(reply.question_id, list);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-slate-500">ติดต่อผู้บริหาร</p>
        <h1 className="mt-1 text-2xl font-semibold">ส่งคำถามหรือขอนัดหมาย</h1>
        <p className="mt-1 text-sm text-slate-500">
          เลือกส่งถึงผู้บริหารที่ต้องการ หรือปล่อยว่างเพื่อส่งถึงผู้บริหารทุกคน
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">ส่งคำถาม</h2>
          <SendQuestionForm executives={executives} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">ขอนัดหมาย</h2>
          <CreateMeetingForm executives={executives} />
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">ประวัติคำถามของฉัน</h2>
          <p className="text-xs text-slate-400">แสดง {HISTORY_LIMIT} รายการล่าสุด</p>
        </div>
        <QuestionHistoryList
          questions={(myQuestions ?? []).map((q) => ({
            id: q.id,
            question: q.question,
            status: q.status,
            recipientName: q.recipient_person_id
              ? (nameById.get(q.recipient_person_id) ?? "ผู้บริหาร")
              : "ผู้บริหารทุกคน",
            createdAt: q.created_at,
            replies: (repliesByQuestion.get(q.id) ?? []).map((r) => ({
              id: r.id,
              body: r.body,
              authorName: nameById.get(r.author_person_id) ?? "ผู้บริหาร",
              createdAt: r.created_at,
            })),
          }))}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">ประวัติคำขอนัดหมายของฉัน</h2>
          <p className="text-xs text-slate-400">แสดง {HISTORY_LIMIT} รายการล่าสุด</p>
        </div>
        <MeetingHistoryList
          meetings={(myMeetings ?? []).map((m) => ({
            id: m.id,
            topic: m.topic,
            requestedStart: m.requested_start,
            durationMinutes: m.duration_minutes,
            location: m.location,
            status: m.status,
            executiveRemark: m.executive_remark,
            proposedStart: m.proposed_start,
            proposedLocation: m.proposed_location,
            recipientName: m.recipient_person_id
              ? (nameById.get(m.recipient_person_id) ?? "ผู้บริหาร")
              : "ผู้บริหารทุกคน",
          }))}
        />
      </section>
    </div>
  );
}
