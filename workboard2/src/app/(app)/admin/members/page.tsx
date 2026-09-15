import { createClient } from "@/lib/supabase/server";
import {
  createAppointment,
  createPerson,
  createPersonRole,
  createTeamMembership,
} from "../actions";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  HEAD: "หัวหน้าฝ่าย",
  MEMBER: "สมาชิก",
  EXECUTIVE: "ประธาน",
};

export default async function MembersPage() {
  const supabase = await createClient();

  const [
    { data: people },
    { data: positions },
    { data: roles },
    { data: workingTeams },
    { data: projectTeams },
    { data: memberships },
  ] = await Promise.all([
    supabase.from("people").select("id, full_name, email").order("full_name"),
    supabase.from("positions").select("id, title").order("title"),
    supabase.from("person_roles").select("id, person_id, role"),
    supabase.from("working_teams").select("id, name").order("name"),
    supabase.from("project_teams").select("id, name").order("name"),
    supabase
      .from("team_memberships")
      .select("id, person_id, team_kind, working_team_id, project_team_id"),
  ]);

  const rolesByPerson = new Map<string, string[]>();
  for (const r of roles ?? []) {
    const list = rolesByPerson.get(r.person_id) ?? [];
    list.push(ROLE_LABELS[r.role] ?? r.role);
    rolesByPerson.set(r.person_id, list);
  }

  const teamsByPerson = new Map<string, string[]>();
  for (const m of memberships ?? []) {
    const name =
      m.team_kind === "WORKING"
        ? workingTeams?.find((t) => t.id === m.working_team_id)?.name
        : projectTeams?.find((t) => t.id === m.project_team_id)?.name;
    if (!name) continue;
    const list = teamsByPerson.get(m.person_id) ?? [];
    list.push(name);
    teamsByPerson.set(m.person_id, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">สมาชิกและบทบาท</h1>
        <p className="text-sm text-slate-500">
          คนหนึ่งมีได้หลายบทบาท หลายตำแหน่ง และหลายทีมพร้อมกัน
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-slate-400">
              <th className="pb-2">ชื่อ</th>
              <th className="pb-2">อีเมล</th>
              <th className="pb-2">บทบาท</th>
              <th className="pb-2">ทีม</th>
            </tr>
          </thead>
          <tbody>
            {(people ?? []).map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="py-2">{p.full_name}</td>
                <td className="py-2">{p.email}</td>
                <td className="py-2">
                  {(rolesByPerson.get(p.id) ?? []).join(", ") || "-"}
                </td>
                <td className="py-2">
                  {(teamsByPerson.get(p.id) ?? []).join(", ") || "-"}
                </td>
              </tr>
            ))}
            {(people ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-slate-400">
                  ยังไม่มีบุคลากร
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">เพิ่มบุคลากร</h2>
          <form action={createPerson} className="flex flex-col gap-2">
            <input
              name="full_name"
              placeholder="ชื่อ-นามสกุล"
              required
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            <input
              name="email"
              type="email"
              placeholder="อีเมล (ต้องตรงกับบัญชี Supabase Auth)"
              required
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="self-start rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
            >
              เพิ่ม
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">มอบบทบาท</h2>
          <form action={createPersonRole} className="flex flex-col gap-2">
            <select
              name="person_id"
              required
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">เลือกบุคลากร</option>
              {(people ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
            <select
              name="role"
              required
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="self-start rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
            >
              มอบบทบาท
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">แต่งตั้งตำแหน่ง</h2>
          <form action={createAppointment} className="flex flex-col gap-2">
            <select
              name="person_id"
              required
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">เลือกบุคลากร</option>
              {(people ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
            <select
              name="position_id"
              required
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">เลือกตำแหน่ง</option>
              {(positions ?? []).map((pos) => (
                <option key={pos.id} value={pos.id}>
                  {pos.title}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="self-start rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
            >
              แต่งตั้ง
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">เพิ่มเข้าทีม</h2>
          <form action={createTeamMembership} className="flex flex-col gap-2">
            <select
              name="person_id"
              required
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">เลือกบุคลากร</option>
              {(people ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <select
                name="team_kind"
                required
                className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                <option value="WORKING">Working Team</option>
                <option value="PROJECT">Project Team</option>
              </select>
              <select
                name="team_id"
                required
                className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                <option value="">เลือกทีม</option>
                {(workingTeams ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (Working)
                  </option>
                ))}
                {(projectTeams ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (Project)
                  </option>
                ))}
              </select>
            </div>
            <input
              name="role_in_team"
              placeholder="บทบาทในทีม (ถ้ามี)"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="self-start rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
            >
              เพิ่ม
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
