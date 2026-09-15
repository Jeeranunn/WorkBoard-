import { createClient } from "@/lib/supabase/server";
import { createTeam } from "../actions";

export default async function TeamsPage() {
  const supabase = await createClient();

  const [{ data: organizations }, { data: workingTeams }, { data: projectTeams }] =
    await Promise.all([
      supabase.from("organizations").select("id, name").order("name"),
      supabase
        .from("working_teams")
        .select("id, name, organization_id")
        .order("name"),
      supabase
        .from("project_teams")
        .select("id, name, organization_id")
        .order("name"),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">ทีม</h1>
        <p className="text-sm text-slate-500">
          ทีมแยกจากโครงสร้างองค์กร — Working Team เป็นทีมถาวร, Project Team
          ผูกกับโครงการ
        </p>
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">Working Team</h2>
          <ul className="mb-4 space-y-1 text-sm text-slate-700">
            {(workingTeams ?? []).map((t) => (
              <li key={t.id}>{t.name}</li>
            ))}
            {(workingTeams ?? []).length === 0 && (
              <li className="text-slate-400">ยังไม่มีทีม</li>
            )}
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">Project Team</h2>
          <ul className="mb-4 space-y-1 text-sm text-slate-700">
            {(projectTeams ?? []).map((t) => (
              <li key={t.id}>{t.name}</li>
            ))}
            {(projectTeams ?? []).length === 0 && (
              <li className="text-slate-400">ยังไม่มีทีม</li>
            )}
          </ul>
        </div>
      </section>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">เพิ่มทีม</h2>
        <form action={createTeam} className="grid gap-2 md:grid-cols-4">
          <select
            name="kind"
            required
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="WORKING">Working Team</option>
            <option value="PROJECT">Project Team</option>
          </select>
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
          <input
            name="name"
            placeholder="ชื่อทีม"
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
