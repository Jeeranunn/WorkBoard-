import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { bangkokTodayKey, formatThaiDateTime } from "@/lib/date-time";
import { LiveElapsedTime } from "@/components/time/live-elapsed-time";

export default async function HeadCapacityPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isAdmin = hasRole(user, "ADMIN");
  const headOrgIds = [
    ...new Set(
      user.roles
        .filter((grant) => grant.role === "HEAD" && grant.organizationId)
        .map((grant) => grant.organizationId as string),
    ),
  ];

  if (!isAdmin && headOrgIds.length === 0) redirect("/overview");

  const supabase = await createClient();
  const today = bangkokTodayKey();

  const { data: organizations } = isAdmin
    ? await supabase
        .from("organizations")
        .select("id, name")
        .eq("is_active", true)
        .order("name")
    : await supabase
        .from("organizations")
        .select("id, name")
        .in("id", headOrgIds)
        .order("name");

  const orgIds = (organizations ?? []).map((org) => org.id);

  const { data: managedPeople } = orgIds.length
    ? await supabase.rpc("managed_people_in_organizations", {
        p_organization_ids: orgIds,
      })
    : {
        data: [] as {
          person_id: string;
          full_name: string;
          organization_id: string;
        }[],
      };

  const personIds = [
    ...new Set((managedPeople ?? []).map((person) => person.person_id)),
  ];

  const [
    { data: timeSnapshot },
    { data: availability },
    { data: slots },
  ] = await Promise.all([
    personIds.length
      ? supabase.rpc("capacity_time_snapshot")
      : Promise.resolve({
          data: [] as {
            person_id: string;
            attendance_session_id: string | null;
            clock_in_at: string | null;
            is_on_break: boolean;
            break_started_at: string | null;
            active_task_id: string | null;
            active_task_started_at: string | null;
            active_task_accumulated_seconds: number;
          }[],
        }),
    personIds.length
      ? supabase
          .from("availability")
          .select("person_id, start_time, end_time, status, note")
          .in("person_id", personIds)
          .eq("date", today)
          .order("start_time")
      : Promise.resolve({
          data: [] as {
            person_id: string;
            start_time: string;
            end_time: string;
            status: "free" | "busy" | "maybe";
            note: string | null;
          }[],
        }),
    personIds.length
      ? supabase
          .from("planned_slots")
          .select(
            "person_id, start_time, end_time, workboard_task_id, personal_planner_item_id",
          )
          .in("person_id", personIds)
          .eq("date", today)
          .order("start_time")
      : Promise.resolve({
          data: [] as {
            person_id: string;
            start_time: string;
            end_time: string;
            workboard_task_id: string | null;
            personal_planner_item_id: string | null;
          }[],
        }),
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
        .filter((row) => personIds.includes(row.person_id))
        .map((row) => row.active_task_id)
        .filter((id): id is string => Boolean(id)),
    ]),
  ];

  const [{ data: personalItems }, { data: tasks }] = await Promise.all([
    personalIds.length
      ? supabase
          .from("personal_planner_items")
          .select("id, title, notes")
          .in("id", personalIds)
      : Promise.resolve({
          data: [] as { id: string; title: string; notes: string | null }[],
        }),
    taskIds.length
      ? supabase.from("tasks").select("id, title").in("id", taskIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);

  const timeByPerson = new Map(
    (timeSnapshot ?? [])
      .filter((row) => personIds.includes(row.person_id))
      .map((row) => [row.person_id, row]),
  );
  const personalById = new Map((personalItems ?? []).map((item) => [item.id, item]));
  const taskById = new Map((tasks ?? []).map((task) => [task.id, task]));
  const orgNameById = new Map((organizations ?? []).map((org) => [org.id, org.name]));

  const availabilityByPerson = new Map<string, NonNullable<typeof availability>>();
  for (const item of availability ?? []) {
    const list = availabilityByPerson.get(item.person_id) ?? [];
    list.push(item);
    availabilityByPerson.set(item.person_id, list);
  }

  const slotsByPerson = new Map<string, NonNullable<typeof slots>>();
  for (const item of slots ?? []) {
    const list = slotsByPerson.get(item.person_id) ?? [];
    list.push(item);
    slotsByPerson.set(item.person_id, list);
  }

  const peopleById = new Map<
    string,
    { person_id: string; full_name: string; organizationIds: Set<string> }
  >();
  for (const person of managedPeople ?? []) {
    const existing = peopleById.get(person.person_id);
    if (existing) {
      existing.organizationIds.add(person.organization_id);
    } else {
      peopleById.set(person.person_id, {
        person_id: person.person_id,
        full_name: person.full_name,
        organizationIds: new Set([person.organization_id]),
      });
    }
  }
  const capacityPeople = [...peopleById.values()];

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">พื้นที่หัวหน้าฝ่าย</p>
          <h1 className="mt-1 text-2xl font-semibold">Capacity วันนี้</h1>
          <p className="mt-1 text-sm text-slate-500">
            เห็นเหตุผลที่สมาชิกว่างหรือไม่ว่าง และงานที่วางไว้ในวันนี้ เฉพาะองค์กรที่คุณดูแล
          </p>
        </div>
        <Link
          href="/head"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          กลับพื้นที่หัวหน้าฝ่าย
        </Link>
      </header>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead>
            <tr className="text-slate-400">
              <th className="px-4 py-3">สมาชิก</th>
              <th className="px-4 py-3">องค์กร</th>
              <th className="px-4 py-3">เข้างาน</th>
              <th className="px-4 py-3">Availability</th>
              <th className="px-4 py-3">กำลังวางอะไรไว้</th>
            </tr>
          </thead>
          <tbody>
            {capacityPeople.map((person) => {
              const personAvailability =
                availabilityByPerson.get(person.person_id) ?? [];
              const personSlots = slotsByPerson.get(person.person_id) ?? [];
              const time = timeByPerson.get(person.person_id);

              return (
                <tr
                  key={person.person_id}
                  className="border-t border-slate-100 align-top"
                >
                  <td className="px-4 py-4 font-medium">{person.full_name}</td>
                  <td className="px-4 py-4 text-slate-500">
                    {[...person.organizationIds]
                      .map((id) => orgNameById.get(id) ?? "-")
                      .join(", ")}
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
                            <div className="mt-1 font-medium">
                              {formal?.title ?? personal?.title ?? "รายการ"}
                            </div>
                            {personal?.notes && (
                              <div className="mt-1 text-xs text-slate-500">
                                {personal.notes}
                              </div>
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
                          <div className="mt-1 font-medium">
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
            {capacityPeople.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  ยังไม่มีสมาชิกในขอบเขตที่คุณดูแล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
