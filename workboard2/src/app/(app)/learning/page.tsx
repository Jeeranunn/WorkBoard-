import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { formatThaiDate, formatThaiDateTime } from "@/lib/date-time";
import { LearningReflectionForm } from "@/components/learning/learning-reflection-form";

const HISTORY_LIMIT = 20;

export default async function LearningPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();

  // Single query: everything on this page is the caller's own history, so
  // there is nothing else that needs a separate round trip.
  const { data: reflections } = await supabase
    .from("learning_reflections")
    .select("id, meeting_name, meeting_date, note, created_at")
    .eq("person_id", user.personId)
    .order("meeting_date", { ascending: false })
    .limit(HISTORY_LIMIT);

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <p className="text-sm text-slate-500">การเรียนรู้ของฉัน</p>
        <h1 className="mt-1 text-2xl font-semibold">บันทึกสิ่งที่ได้เรียนรู้</h1>
        <p className="mt-1 text-sm text-slate-500">
          สรุปสั้น ๆ หลังการประชุมหรือกิจกรรม เพื่อเก็บเป็นประวัติของตัวเอง
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">บันทึกใหม่</h2>
        <LearningReflectionForm />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">ประวัติการเรียนรู้</h2>
          <p className="text-xs text-slate-400">
            แสดง {HISTORY_LIMIT} รายการล่าสุด
          </p>
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {(reflections ?? []).map((item) => (
            <div key={item.id} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-medium">{item.meeting_name}</div>
                <div className="shrink-0 text-xs text-slate-400">
                  {formatThaiDate(item.meeting_date, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                {item.note}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                บันทึกเมื่อ {formatThaiDateTime(item.created_at)}
              </p>
            </div>
          ))}
          {(reflections ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">
              ยังไม่มีบันทึกการเรียนรู้
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
