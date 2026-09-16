import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { bangkokTodayKey, formatThaiDateTime } from "@/lib/date-time";
import { LiveElapsedTime } from "@/components/time/live-elapsed-time";

export default async function ExecutiveCapacityPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  if (!hasRole(user, "ADMIN") && !hasRole(user, "EXECUTIVE")) {
    redirect("/overview");
  }

  const supabase = await createClient();
  const today = bangkokTodayKey();

  const [
    { data: people },
    { data: timeSnapshot },
    { data: availability },
    { data: slots },
  ] = await Promise.all([
    supabase.from("people").select("id, full_name").order("full_name"),
    supabase.rpc("capacity_time_snapshot"),
    supabase
      .from("availability")
      .select("person_id, date, start_time, end_time, status, note")
      .eq("date", today)
      .order("start_time"),
    supabase
      .from("planned_slots")
      .select(
        "person_id, date, start_time, end_time, workboard_task_id, personal_planner_item_id",
      )
      .eq("date", today)
      .order("start_time"),
  ]);

  const personalIds = [
    ...new Set(
      (slots ?? [])
        .map((slot) => slot.personal_planner_item_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const taskIds = [
    ...new Set([
      ...(slots ?? [])
        .map((slot) => slot.workboard_task_id)
        .filter((id): id is string => Boolean(id)),
      ...(timeSnapshot ?? [])
        .map((row) => row.active_task_id)
        .filter((id): id is string => Boolean(id)),
    ]),
  ];

  const [{ data: personalItems }, { data: tasks }] = await Promise.all([
    personalIds.length
      ? supabase
          .from("personal_planner_items")
          .select("id, person_id, title, notes")
          .in("id", personalIds)
      : Promise.resolve({
          data: [] as { id: string; person_id: string; title: string; notes: string | null }[],
        }),
    taskIds.length
      ? supabase.from("tasks").select("id, title").in("id", taskIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);

  const nameById = new Map((people ?? []).map((person) => [person.id, person.full_name]));
  const personalById = new Map((personalItems ?? []).map((item) => [item.id, item]));
  const taskById = new Map((tasks ?? []).map((task) => [task.id, task]));
  const timeByPerson = new Map(
    (timeSnapshot ?? []).map((row) => [row.person_id, row]),
  );

  const availabilityByPerson = new Map<string, NonNullable<typeof availability>>();
  for (const row of availability ?? []) {
    const list = availabilityByPerson.get(row.person_id) ?? [];
    list.push(row);
    availabilityByPerson.set(row.person_id, list);
  }

  const slotsByPerson = new Map<string, NonNullable<typeof slots>>();
  for (const row of slots ?? []) {
    const list = slotsByPerson.get(row.person_id) ?? [];
    list.push(row);
    slotsByPerson.set(row.person_id, list);
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">ภาพรวมกำลังคน</p>
          <h1 className="mt-1 text-2xl font-semibold">Capacity วันนี้</h1>
          <p className="mt-1 text-sm text-slate-500">
            เห็นทั้งช่วงว่าง/ไม่ว่าง งาน WorkBoard และงานส่วนตัวที่ทำให้แต่ละคนไม่ว่าง
          </p>
        </div>
        <Link
          href="/executive"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          กลับภาพรวมผู้บริหาร
        </Link>
      </header>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead>
            <tr className="text-slate-400">
              <th className="px-4 py-3">บุคลากร</th>
              <th className="px-4 py-3">สถานะเข้างาน</th>
              <th className="px-4 py-3">Availability</th>
              <th className="px-4 py-3">ตารางวันนี้</th>
            </tr>
          </thead>
          <tbody>
            {(people ?? []).map((person) => {
              const personAvailability = availabilityByPerson.get(person.id) ?? [];
              const personSlots = slotsByPerson.get(person.id) ?? [];
              const time = timeByPerson.get(person.id);

              return (
                <tr key={person.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-4 font-medium">
                    {nameById.get(person.id) ?? "-"}
                  </td>
                  <td className="px-4 py-4">
                    {time?.clock_in_at ? (
                      <div className="space-y-1">
                        <div className={time.is_on_break ? "text-amber-600" : "text-emerald-700"}>
                          {time.is_on_break ? "กำลังพัก" : "Clock In อยู่"}
                        </div>
                        <div className="text-xs text-slate-500">
                          เข้า {formatThaiDateTime(time.clock_in_at)}
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-slate-400">ผ่านมา</span>
                          <LiveElapsedTime
                            startedAt={time.clock_in_at}
                            className="font-mono font-semibold tabular-nums"
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">ยังไม่ Clock In</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      {personAvailability.map((block, index) => (
                        <div key={index} className="rounded-md bg-slate-50 p-2">
                          <div className="text-xs font-medium">
                            {block.start_time.slice(0, 5)}–{block.end_time.slice(0, 5)} ·{" "}
                            {block.status === "free"
                              ? "ว่าง"
                              : block.status === "busy"
                                ? "ไม่ว่าง"
                                : "อาจว่าง"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {block.note || "ไม่ได้ระบุเหตุผล"}
                          </div>
                        </div>
                      ))}
                      {personAvailability.length === 0 && (
                        <span className="text-xs text-slate-400">ยังไม่ได้ระบุ</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      {personSlots.map((slot, index) => {
                        const personal = slot.personal_planner_item_id
                          ? personalById.get(slot.personal_planner_item_id)
                          : null;
                        const formal = slot.workboard_task_id
                          ? taskById.get(slot.workboard_task_id)
                          : null;
                        return (
                          <div key={index} className="rounded-md border border-slate-200 p-2">
                            <div className="text-xs text-slate-400">
                              {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                            </div>
                            <div className="mt-1 text-sm font-medium">
                              {formal?.title ?? personal?.title ?? "รายการ"}
                            </div>
                            {personal?.notes && (
                              <div className="mt-1 text-xs text-slate-500">{personal.notes}</div>
                            )}
                            <div className="mt-1 text-[11px] text-slate-400">
                              {formal ? "งาน WorkBoard" : "งานส่วนตัว"}
                            </div>
                          </div>
                        );
                      })}
                      {time?.active_task_id && time.active_task_started_at && (
                        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2">
                          <div className="text-[11px] text-emerald-700">
                            กำลังจับเวลางานจริง
                          </div>
                          <div className="mt-1 text-sm font-medium">
                            {taskById.get(time.active_task_id)?.title ?? "งาน WorkBoard"}
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-xs text-emerald-700">
                            <span>เวลาสะสม</span>
                            <LiveElapsedTime
                              startedAt={time.active_task_started_at}
                              baseSeconds={time.active_task_accumulated_seconds}
                              className="font-mono font-semibold tabular-nums"
                            />
                          </div>
                        </div>
                      )}
                      {personSlots.length === 0 && !time?.active_task_id && (
                        <span className="text-xs text-slate-400">ยังไม่มีรายการในแผน</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
