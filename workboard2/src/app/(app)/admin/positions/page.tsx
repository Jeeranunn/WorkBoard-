import { createClient } from "@/lib/supabase/server";
import { createPosition } from "../actions";

export default async function PositionsPage() {
  const supabase = await createClient();

  const [{ data: units }, { data: positions }] = await Promise.all([
    supabase.from("organization_units").select("id, name").order("name"),
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
          ตำแหน่งภายในหน่วยงาน ผูกกับการแต่งตั้งบุคคล (Appointment)
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-slate-400">
              <th className="pb-2">ชื่อตำแหน่ง</th>
              <th className="pb-2">หน่วยงาน</th>
              <th className="pb-2">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {(positions ?? []).map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="py-2">{p.title}</td>
                <td className="py-2">
                  {units?.find((u) => u.id === p.unit_id)?.name ?? "-"}
                </td>
                <td className="py-2">
                  {p.valid_to ? "สิ้นสุดแล้ว" : "ใช้งานอยู่"}
                </td>
              </tr>
            ))}
            {(positions ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-slate-400">
                  ยังไม่มีตำแหน่ง
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">เพิ่มตำแหน่ง</h2>
        <form action={createPosition} className="grid gap-2 md:grid-cols-3">
          <select
            name="unit_id"
            required
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">เลือกหน่วยงาน</option>
            {(units ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <input
            name="title"
            placeholder="ชื่อตำแหน่ง"
            required
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
          >
            เพิ่ม
          </button>
        </form>
      </div>
    </div>
  );
}
