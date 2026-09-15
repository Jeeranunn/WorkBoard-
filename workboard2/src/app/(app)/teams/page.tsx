import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const TEAM_TYPE_LABELS: Record<string, string> = {
  WORKING: "Working Team",
  PROJECT: "Project Team",
};

export default async function TeamsListPage() {
  const supabase = await createClient();

  const [{ data: teams }, { data: memberships }] = await Promise.all([
    supabase.from("teams").select("id, name, team_type").order("name"),
    supabase.from("team_memberships").select("team_id").is("valid_to", null),
  ]);

  const memberCount = new Map<string, number>();
  for (const m of memberships ?? []) {
    memberCount.set(m.team_id, (memberCount.get(m.team_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">ทีม</h1>
        <p className="text-sm text-slate-500">ภาพรวมทีมและสมาชิก</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-slate-400">
              <th className="px-4 py-2">ชื่อทีม</th>
              <th className="px-4 py-2">ประเภท</th>
              <th className="px-4 py-2">จำนวนสมาชิก</th>
            </tr>
          </thead>
          <tbody>
            {(teams ?? []).map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  <Link href={`/teams/${t.id}`} className="font-medium hover:underline">
                    {t.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {TEAM_TYPE_LABELS[t.team_type] ?? t.team_type}
                </td>
                <td className="px-4 py-2">{memberCount.get(t.id) ?? 0}</td>
              </tr>
            ))}
            {(teams ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-slate-400">
                  ยังไม่มีทีม
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
