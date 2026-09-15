import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { ACTIVE_TASK_STATUSES } from "@/lib/task-labels";
import { PlannerActionForm } from "@/components/planner/action-form";
import {
  addAvailabilityAction,
  addPersonalItemAction,
  addPlannedSlotAction,
  respondSuggestionAction,
  togglePersonalItemAction,
} from "./actions";

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekDays(reference = new Date()) {
  const start = new Date(reference);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

const availabilityLabel = {
  free: "ว่าง",
  busy: "ไม่ว่าง",
  maybe: "อาจว่าง",
} as const;

export default async function WeeklyPlanPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const days = weekDays();
  const startDate = localDateKey(days[0]);
  const endDate = localDateKey(days[6]);
  const supabase = await createClient();

  const [
    { data: tasks },
    { data: personalItems },
    { data: availability },
    { data: slots },
    { data: suggestions },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, deadline, priority, status")
      .eq("assignee_person_id", user.personId)
      .in("status", ACTIVE_TASK_STATUSES)
      .order("deadline", { ascending: true, nullsFirst: false }),
    supabase
      .from("personal_planner_items")
      .select(
        "id, title, deadline, estimated_hours, is_important, is_urgent, completed_at",
      )
      .eq("person_id", user.personId)
      .order("completed_at", { ascending: true, nullsFirst: true })
      .order("deadline", { ascending: true, nullsFirst: false }),
    supabase
      .from("availability")
      .select("id, date, start_time, end_time, status, note")
      .eq("person_id", user.personId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date")
      .order("start_time"),
    supabase
      .from("planned_slots")
      .select(
        "id, date, start_time, end_time, workboard_task_id, personal_planner_item_id",
      )
      .eq("person_id", user.personId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date")
      .order("start_time"),
    supabase
      .from("suggestions")
      .select(
        "id, task_id, suggested_is_important, suggested_is_urgent, reason, created_at",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  const taskName = new Map((tasks ?? []).map((task) => [task.id, task.title]));
  const personalName = new Map(
    (personalItems ?? []).map((item) => [item.id, item.title]),
  );

  const slotsByDate = new Map<string, NonNullable<typeof slots>>();
  for (const slot of slots ?? []) {
    const list = slotsByDate.get(slot.date) ?? [];
    list.push(slot);
    slotsByDate.set(slot.date, list);
  }

  const availabilityByDate = new Map<string, NonNullable<typeof availability>>();
  for (const block of availability ?? []) {
    const list = availabilityByDate.get(block.date) ?? [];
    list.push(block);
    availabilityByDate.set(block.date, list);
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">แผนรายสัปดาห์</h1>
          <p className="text-sm text-slate-500">
            วางงานจริงและงานส่วนตัวลงเวลาเดียวกัน โดยงาน WorkBoard ยังเป็นข้อมูลหลัก
          </p>
        </div>
        <Link
          href="/my-work"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
        >
          กลับไปงานของฉัน
        </Link>
      </header>

      {(suggestions ?? []).length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-semibold">คำแนะนำลำดับความสำคัญที่รอคุณตอบ</h2>
          <div className="mt-3 space-y-3">
            {(suggestions ?? []).map((suggestion) => (
              <div
                key={suggestion.id}
                className="rounded-lg border border-amber-200 bg-white p-3"
              >
                <div className="text-sm font-medium">
                  {taskName.get(suggestion.task_id) ?? "งานใน WorkBoard"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  เสนอเป็น{" "}
                  {suggestion.suggested_is_important ? "สำคัญ" : "ไม่สำคัญ"} /{" "}
                  {suggestion.suggested_is_urgent ? "เร่งด่วน" : "ไม่เร่งด่วน"}
                  {suggestion.reason ? ` — ${suggestion.reason}` : ""}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <PlannerActionForm
                    action={respondSuggestionAction}
                    submitLabel="รับคำแนะนำ"
                    pendingLabel="กำลังตอบ..."
                    className="space-y-1"
                    buttonClassName="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                  >
                    <input type="hidden" name="suggestion_id" value={suggestion.id} />
                    <input type="hidden" name="status" value="accepted" />
                  </PlannerActionForm>
                  <PlannerActionForm
                    action={respondSuggestionAction}
                    submitLabel="ไม่รับ"
                    pendingLabel="กำลังตอบ..."
                    className="space-y-1"
                    buttonClassName="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                  >
                    <input type="hidden" name="suggestion_id" value={suggestion.id} />
                    <input type="hidden" name="status" value="rejected" />
                  </PlannerActionForm>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="overflow-x-auto pb-2">
        <div className="grid min-w-[1050px] grid-cols-7 gap-3">
          {days.map((day) => {
            const key = localDateKey(day);
            const daySlots = slotsByDate.get(key) ?? [];
            const dayAvailability = availabilityByDate.get(key) ?? [];

            return (
              <article
                key={key}
                className="min-h-64 rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="border-b border-slate-100 pb-2">
                  <div className="text-xs text-slate-400">
                    {day.toLocaleDateString("th-TH", { weekday: "short" })}
                  </div>
                  <div className="font-semibold">
                    {day.toLocaleDateString("th-TH", {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {dayAvailability.map((block) => (
                    <div
                      key={block.id}
                      className="rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600"
                    >
                      {block.start_time.slice(0, 5)}–{block.end_time.slice(0, 5)} ·{" "}
                      {availabilityLabel[block.status]}
                      {block.note ? ` · ${block.note}` : ""}
                    </div>
                  ))}

                  {daySlots.map((slot) => {
                    const formal = Boolean(slot.workboard_task_id);
                    const title = slot.workboard_task_id
                      ? taskName.get(slot.workboard_task_id)
                      : slot.personal_planner_item_id
                        ? personalName.get(slot.personal_planner_item_id)
                        : null;

                    return (
                      <div
                        key={slot.id}
                        className="rounded-lg border border-slate-200 p-2 text-xs"
                      >
                        <div className="text-slate-400">
                          {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                        </div>
                        <div className="mt-1 font-medium">{title ?? "รายการ"}</div>
                        <div className="mt-1 text-[11px] text-slate-400">
                          {formal ? "งาน WorkBoard" : "งานส่วนตัว"}
                        </div>
                      </div>
                    );
                  })}

                  {daySlots.length === 0 && (
                    <p className="pt-3 text-center text-xs text-slate-400">
                      ยังไม่ได้วางงาน
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">วางงานลงตาราง</h2>
          <p className="mb-3 text-xs text-slate-500">
            เลือกได้ทั้งงานที่ได้รับมอบหมายและงานส่วนตัว
          </p>
          <PlannerActionForm
            action={addPlannedSlotAction}
            submitLabel="วางลงตาราง"
          >
            <select
              name="source"
              required
              defaultValue=""
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="" disabled>
                เลือกงาน
              </option>
              {(tasks ?? []).map((task) => (
                <option key={task.id} value={`task:${task.id}`}>
                  [WorkBoard] {task.title}
                </option>
              ))}
              {(personalItems ?? [])
                .filter((item) => !item.completed_at)
                .map((item) => (
                  <option key={item.id} value={`personal:${item.id}`}>
                    [ส่วนตัว] {item.title}
                  </option>
                ))}
            </select>
            <input
              name="date"
              type="date"
              required
              min={startDate}
              max={endDate}
              defaultValue={localDateKey(new Date())}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                name="start_time"
                type="time"
                required
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                name="end_time"
                type="time"
                required
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </PlannerActionForm>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">เวลาว่าง / ไม่ว่าง</h2>
          <p className="mb-3 text-xs text-slate-500">
            ใช้ช่วยวางแผนกำลังคน โดยงานส่วนตัวยังคงเป็นส่วนตัว
          </p>
          <PlannerActionForm
            action={addAvailabilityAction}
            submitLabel="บันทึกช่วงเวลา"
          >
            <input
              name="date"
              type="date"
              required
              min={startDate}
              max={endDate}
              defaultValue={localDateKey(new Date())}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                name="start_time"
                type="time"
                required
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                name="end_time"
                type="time"
                required
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <select
              name="status"
              defaultValue="free"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="free">ว่าง</option>
              <option value="maybe">อาจว่าง</option>
              <option value="busy">ไม่ว่าง</option>
            </select>
            <input
              name="note"
              placeholder="หมายเหตุ (ถ้ามี)"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </PlannerActionForm>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">เพิ่มงานส่วนตัว</h2>
          <p className="mb-3 text-xs text-slate-500">
            รายการนี้เป็นส่วนตัว ผู้บริหารไม่เห็นเนื้อหางาน
          </p>
          <PlannerActionForm
            action={addPersonalItemAction}
            submitLabel="เพิ่มรายการ"
          >
            <input
              name="title"
              required
              placeholder="เช่น เตรียมอ่านเอกสาร"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="deadline"
              type="datetime-local"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="estimated_hours"
              type="number"
              min="0.25"
              step="0.25"
              placeholder="ชั่วโมงโดยประมาณ"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input name="is_important" type="checkbox" defaultChecked />
                สำคัญ
              </label>
              <label className="flex items-center gap-2">
                <input name="is_urgent" type="checkbox" />
                เร่งด่วน
              </label>
            </div>
          </PlannerActionForm>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">งานส่วนตัวของฉัน</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {(personalItems ?? []).map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <div
                  className={
                    item.completed_at
                      ? "text-sm text-slate-400 line-through"
                      : "text-sm font-medium"
                  }
                >
                  {item.title}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {item.is_important ? "สำคัญ" : "ไม่สำคัญ"} ·{" "}
                  {item.is_urgent ? "เร่งด่วน" : "ไม่เร่งด่วน"}
                  {item.estimated_hours ? ` · ${item.estimated_hours} ชม.` : ""}
                </div>
              </div>
              <PlannerActionForm
                action={togglePersonalItemAction}
                submitLabel={item.completed_at ? "เปิดอีกครั้ง" : "เสร็จแล้ว"}
                pendingLabel="กำลังบันทึก..."
                className="space-y-1"
                buttonClassName="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-60"
              >
                <input type="hidden" name="item_id" value={item.id} />
                <input
                  type="hidden"
                  name="next_completed"
                  value={item.completed_at ? "false" : "true"}
                />
              </PlannerActionForm>
            </div>
          ))}
          {(personalItems ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">
              ยังไม่มีงานส่วนตัว
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
