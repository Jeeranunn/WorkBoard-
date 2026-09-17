import { createClient } from "@/lib/supabase/server";
import { createPosition, endPosition } from "../actions";
import { AdminActionForm } from "@/components/admin/action-form";

export default async function PositionsPage() {
  const supabase = await createClient();

  const [{ data: units }, { data: positions }] = await Promise.all([
    supabase
      .from("organization_units")
      .select("id, name, valid_to")
      .order("name"),
    supabase
      .from("positions")
      .select("id, title, unit_id, valid_to")
      .order("title"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">ตำแหน่ง</h1>
        <p className="text-sm text-slate-500">
          ตำแหน่งผูกกับการแต่งตั้งบุคคล และเก็บประวัติด้วย valid_from / valid_to
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-4">
        <table className="min-w-[680px] w-full text-left text-sm">
          <thead>
            <tr className="text-slate-400">
              <th className="pb-2">ชื่อตำแหน่ง</th>
              <th className="pb-2">หน่วยงาน</th>
              <th className="pb-2">สถานะ</th>
              <th className="pb-2">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {(positions ?? []).map((position) => (
              <tr key={position.id} className="border-t border-slate-100">
                <td className="py-2">{position.title}</td>
                <td className="py-2">
                  {(units ?? []).find((unit) => unit.id === position.unit_id)?.name ?? "-"}
                </td>
                <td className="py-2">{position.valid_to ? "สิ้นสุดแล้ว" : "ใช้งานอยู่"}</td>
                <td className="py-2">
                  {!position.valid_to && (
                    <AdminActionForm
                      action={endPosition}
                      submitLabel="สิ้นสุด"
                      className="space-y-1"
                      buttonClassName="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-60"
                    >
                      <input type="hidden" name="id" value={position.id} />
                    </AdminActionForm>
                  )}
                </td>
              </tr>
            ))}
            {(positions ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-slate-400">
                  ยังไม่มีตำแหน่ง
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">เพิ่มตำแหน่ง</h2>
        <AdminActionForm
          action={createPosition}
          submitLabel="เพิ่ม"
          className="grid gap-2 md:grid-cols-3"
          buttonClassName="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
        >
          <select
            name="unit_id"
            required
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">เลือกหน่วยงาน</option>
            {(units ?? [])
              .filter((unit) => !unit.valid_to)
              .map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
          </select>
          <input
            name="title"
            placeholder="ชื่อตำแหน่ง"
            required
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </AdminActionForm>
      </div>
    </div>
  );
}
