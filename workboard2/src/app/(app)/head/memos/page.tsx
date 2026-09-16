import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { formatThaiDateTime } from "@/lib/date-time";
import { SendMemoForm } from "@/components/head/send-memo-form";

const HISTORY_LIMIT = 15;

export default async function HeadMemosPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isAdmin = hasRole(user, "ADMIN");
  const isHead = user.roles.some((grant) => grant.role === "HEAD");
  if (!isAdmin && !isHead) {
    redirect("/overview");
  }

  const supabase = await createClient();

  // Round 1: memos sent by this HEAD, and the current executive roster —
  // neither depends on the other.
  const [{ data: memos }, { data: executiveIds }] = await Promise.all([
    supabase
      .from("management_memos")
      .select("id, subject, body, link, created_at")
      .eq("sender_person_id", user.personId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase.rpc("active_executive_people"),
  ]);

  const memoIds = (memos ?? []).map((m) => m.id);

  // Round 2: recipient/ack rows for those memos, and names for the current
  // executive roster — both only depend on round 1's results, not on each
  // other. A recipient who has since left the EXECUTIVE role falls back to
  // a generic label rather than costing a third round trip.
  const [{ data: recipients }, { data: people }] = await Promise.all([
    memoIds.length
      ? supabase
          .from("management_memo_recipients")
          .select("memo_id, recipient_person_id, acknowledged_at")
          .in("memo_id", memoIds)
      : Promise.resolve({
          data: [] as {
            memo_id: string;
            recipient_person_id: string;
            acknowledged_at: string | null;
          }[],
        }),
    (executiveIds ?? []).length
      ? supabase
          .from("people")
          .select("id, full_name")
          .in("id", executiveIds ?? [])
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const recipientsByMemo = new Map<string, typeof recipients>();
  for (const row of recipients ?? []) {
    const list = recipientsByMemo.get(row.memo_id) ?? [];
    list.push(row);
    recipientsByMemo.set(row.memo_id, list);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <p className="text-sm text-slate-500">หัวหน้าฝ่าย</p>
        <h1 className="mt-1 text-2xl font-semibold">บันทึกข้อความถึงผู้บริหาร</h1>
        <p className="mt-1 text-sm text-slate-500">
          ส่งถึงผู้บริหารที่ใช้งานอยู่ทุกคนโดยอัตโนมัติ
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">บันทึกใหม่</h2>
        <SendMemoForm />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">บันทึกที่ส่งไปแล้ว</h2>
          <p className="text-xs text-slate-400">แสดง {HISTORY_LIMIT} รายการล่าสุด</p>
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {(memos ?? []).map((memo) => {
            const recipientRows = recipientsByMemo.get(memo.id) ?? [];
            const ackCount = recipientRows.filter((r) => r.acknowledged_at).length;
            return (
              <div key={memo.id} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium">{memo.subject}</p>
                  <p className="shrink-0 text-xs text-slate-400">
                    {formatThaiDateTime(memo.created_at)}
                  </p>
                </div>
                {memo.body && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                    {memo.body}
                  </p>
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
                <p className="mt-2 text-xs text-slate-500">
                  รับทราบแล้ว {ackCount}/{recipientRows.length} คน
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                  {recipientRows.map((r) => (
                    <span key={r.recipient_person_id}>
                      {nameById.get(r.recipient_person_id) ?? "ผู้บริหาร"}
                      {r.acknowledged_at ? " ✓" : " (ยังไม่รับทราบ)"}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {(memos ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">
              ยังไม่มีบันทึกข้อความที่ส่ง
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
