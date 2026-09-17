import { createClient } from "@/lib/supabase/server";
import { createUnit, endUnit } from "../actions";
import { AdminActionForm } from "@/components/admin/action-form";

export default async function UnitsPage() {
  const supabase = await createClient();

  const [{ data: organizations }, { data: units }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, is_active")
      .order("name"),
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
          หน่วยงานภายในองค์กร รองรับโครงสร้างย่อยหลายชั้นและเก็บประวัติช่วงเวลาที่ใช้งาน
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-4">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead>
            <tr className="text-slate-400">
              <th className="pb-2">ชื่อหน่วยงาน</th>
              <th className="pb-2">องค์กร</th>
              <th className="pb-2">หน่วยงานแม่</th>
              <th className="pb-2">สถานะ</th>
              <th className="pb-2">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {(units ?? []).map((unit) => (
              <tr key={unit.id} className="border-t border-slate-100">
                <td className="py-2">{unit.name}</td>
                <td className="py-2">
                  {(organizations ?? []).find((o) => o.id === unit.organization_id)?.name ?? "-"}
                </td>
                <td className="py-2">
                  {(units ?? []).find((parent) => parent.id === unit.parent_unit_id)?.name ?? "-"}
                </td>
                <td className="py-2">{unit.valid_to ? "สิ้นสุดแล้ว" : "ใช้งานอยู่"}</td>
                <td className="py-2">
                  {!unit.valid_to && (
                    <AdminActionForm
                      action={endUnit}
                      submitLabel="สิ้นสุด"
                      className="space-y-1"
                      buttonClassName="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-60"
                    >
                      <input type="hidden" name="id" value={unit.id} />
                    </AdminActionForm>
                  )}
                </td>
              </tr>
            ))}
            {(units ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-slate-400">
                  ยังไม่มีหน่วยงาน
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">เพิ่มหน่วยงาน</h2>
        <AdminActionForm
          action={createUnit}
          submitLabel="เพิ่ม"
          className="grid gap-2 md:grid-cols-4"
          buttonClassName="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
        >
          <select
            name="organization_id"
            required
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">เลือกองค์กร</option>
            {(organizations ?? [])
              .filter((organization) => organization.is_active)
              .map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
          </select>
          <select
            name="parent_unit_id"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">ไม่มีหน่วยงานแม่</option>
            {(units ?? [])
              .filter((unit) => !unit.valid_to)
              .map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
          </select>
          <input
            name="name"
            placeholder="ชื่อหน่วยงาน"
            required
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </AdminActionForm>
      </div>
    </div>
  );
}
