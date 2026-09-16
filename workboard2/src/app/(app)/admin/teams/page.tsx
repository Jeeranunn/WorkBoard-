import { createClient } from "@/lib/supabase/server";
import { createTeam, setTeamActive } from "../actions";
import { AdminActionForm } from "@/components/admin/action-form";

const TEAM_TYPE_LABELS: Record<string, string> = {
  WORKING: "ทีมปฏิบัติงาน",
  PROJECT: "ทีมโครงการ",
};

export default async function TeamsPage() {
  const supabase = await createClient();

  const [{ data: networks }, { data: organizations }, { data: teams }] =
    await Promise.all([
      supabase.from("networks").select("id, name, is_active").order("name"),
      supabase.from("organizations").select("id, name, is_active").order("name"),
      supabase
        .from("teams")
        .select("id, name, team_type, network_id, owner_organization_id, is_active")
        .order("name"),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">ทีม</h1>
        <p className="text-sm text-slate-500">
          ทีมแยกจากโครงสร้างองค์กร สมาชิกข้ามองค์กรได้ และปิดใช้งานได้โดยไม่ลบประวัติ
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-4">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead>
            <tr className="text-slate-400">
              <th className="pb-2">ชื่อทีม</th>
              <th className="pb-2">ประเภท</th>
              <th className="pb-2">เครือข่าย</th>
              <th className="pb-2">องค์กรเจ้าของ</th>
              <th className="pb-2">สถานะ</th>
              <th className="pb-2">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {(teams ?? []).map((team) => (
              <tr key={team.id} className="border-t border-slate-100">
                <td className="py-2">{team.name}</td>
                <td className="py-2">{TEAM_TYPE_LABELS[team.team_type] ?? team.team_type}</td>
                <td className="py-2">
                  {(networks ?? []).find((network) => network.id === team.network_id)?.name ?? "-"}
                </td>
                <td className="py-2">
                  {(organizations ?? []).find((organization) => organization.id === team.owner_organization_id)?.name ?? "-"}
                </td>
                <td className="py-2">{team.is_active ? "ใช้งานอยู่" : "เก็บเข้าคลังแล้ว"}</td>
                <td className="py-2">
                  <AdminActionForm
                    action={setTeamActive}
                    submitLabel={team.is_active ? "เก็บเข้าคลัง" : "เปิดใช้งาน"}
                    className="space-y-1"
                    buttonClassName="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-60"
                  >
                    <input type="hidden" name="id" value={team.id} />
                    <input type="hidden" name="active" value={team.is_active ? "false" : "true"} />
                  </AdminActionForm>
                </td>
              </tr>
            ))}
            {(teams ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-400">
                  ยังไม่มีทีม
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">เพิ่มทีม</h2>
        <AdminActionForm
          action={createTeam}
          submitLabel="เพิ่ม"
          className="grid gap-2 md:grid-cols-4"
          buttonClassName="col-span-full self-start rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
        >
          <select
            name="team_type"
            required
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="WORKING">ทีมปฏิบัติงาน</option>
            <option value="PROJECT">ทีมโครงการ</option>
          </select>
          <select
            name="network_id"
            required
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">เลือกเครือข่าย</option>
            {(networks ?? [])
              .filter((network) => network.is_active)
              .map((network) => (
                <option key={network.id} value={network.id}>
                  {network.name}
                </option>
              ))}
          </select>
          <select
            name="owner_organization_id"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">ไม่มีองค์กรเจ้าของ</option>
            {(organizations ?? [])
              .filter((organization) => organization.is_active)
              .map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
          </select>
          <input
            name="name"
            placeholder="ชื่อทีม"
            required
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </AdminActionForm>
      </div>
    </div>
  );
}
