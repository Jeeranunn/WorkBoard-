import { createClient } from "@/lib/supabase/server";
import { createTeam } from "../actions";

const TEAM_TYPE_LABELS: Record<string, string> = {
  WORKING: "Working Team",
  PROJECT: "Project Team",
};

export default async function TeamsPage() {
  const supabase = await createClient();

  const [{ data: networks }, { data: organizations }, { data: teams }] =
    await Promise.all([
      supabase.from("networks").select("id, name").order("name"),
      supabase.from("organizations").select("id, name").order("name"),
      supabase
        .from("teams")
        .select("id, name, team_type, network_id, owner_organization_id")
        .order("name"),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">ทีม</h1>
        <p className="text-sm text-slate-500">
          ทีมแยกจากโครงสร้างองค์กร ผูกกับเครือข่าย ไม่ผูกกับองค์กรใดองค์กรหนึ่ง
          — สมาชิกในทีมมาจากหลายองค์กรได้
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-slate-400">
              <th className="pb-2">ชื่อทีม</th>
              <th className="pb-2">ประเภท</th>
              <th className="pb-2">เครือข่าย</th>
              <th className="pb-2">องค์กรเจ้าของ (ถ้ามี)</th>
            </tr>
          </thead>
          <tbody>
            {(teams ?? []).map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="py-2">{t.name}</td>
                <td className="py-2">
                  {TEAM_TYPE_LABELS[t.team_type] ?? t.team_type}
                </td>
                <td className="py-2">
                  {networks?.find((n) => n.id === t.network_id)?.name ?? "-"}
                </td>
                <td className="py-2">
                  {organizations?.find(
                    (o) => o.id === t.owner_organization_id,
                  )?.name ?? "-"}
                </td>
              </tr>
            ))}
            {(teams ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-slate-400">
                  ยังไม่มีทีม
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">เพิ่มทีม</h2>
        <form action={createTeam} className="grid gap-2 md:grid-cols-4">
          <select
            name="team_type"
            required
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="WORKING">Working Team</option>
            <option value="PROJECT">Project Team</option>
          </select>
          <select
            name="network_id"
            required
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">เลือกเครือข่าย</option>
            {(networks ?? []).map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
          <select
            name="owner_organization_id"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">ไม่มีองค์กรเจ้าของ</option>
            {(organizations ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <input
            name="name"
            placeholder="ชื่อทีม"
            required
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="col-span-full self-start rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
          >
            เพิ่ม
          </button>
        </form>
      </div>
    </div>
  );
}
