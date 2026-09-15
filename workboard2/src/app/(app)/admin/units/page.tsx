import { createClient } from "@/lib/supabase/server";
import { createUnit } from "../actions";

export default async function UnitsPage() {
  const supabase = await createClient();

  const [{ data: organizations }, { data: units }] = await Promise.all([
    supabase.from("organizations").select("id, name").order("name"),
    supabase
      .from("organization_units")
      .select("id, name, organization_id, parent_unit_id, valid_to")
      .order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">หน่วยงาน</h1>
        <p className="text-sm text-slate-500">
          หน่วยงานภายในองค์กร รองรับโครงสร้างย่อยหลายชั้น
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-slate-400">
              <th className="pb-2">ชื่อหน่วยงาน</th>
              <th className="pb-2">องค์กร</th>
              <th className="pb-2">หน่วยงานแม่</th>
              <th className="pb-2">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {(units ?? []).map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="py-2">{u.name}</td>
                <td className="py-2">
                  {organizations?.find((o) => o.id === u.organization_id)
                    ?.name ?? "-"}
                </td>
                <td className="py-2">
                  {units?.find((p) => p.id === u.parent_unit_id)?.name ?? "-"}
                </td>
                <td className="py-2">
                  {u.valid_to ? "สิ้นสุดแล้ว" : "ใช้งานอยู่"}
                </td>
              </tr>
            ))}
            {(units ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-slate-400">
                  ยังไม่มีหน่วยงาน
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">เพิ่มหน่วยงาน</h2>
        <form action={createUnit} className="grid gap-2 md:grid-cols-4">
          <select
            name="organization_id"
            required
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">เลือกองค์กร</option>
            {(organizations ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select
            name="parent_unit_id"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">ไม่มีหน่วยงานแม่</option>
            {(units ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <input
            name="name"
            placeholder="ชื่อหน่วยงาน"
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
