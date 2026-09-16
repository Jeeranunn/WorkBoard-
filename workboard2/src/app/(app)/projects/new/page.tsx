import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { createProjectAction } from "../actions";

export default async function NewProjectPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isAdmin = hasRole(user, "ADMIN");
  const headOrgIds = user.roles
    .filter((r) => r.role === "HEAD" && r.organizationId)
    .map((r) => r.organizationId as string);

  if (!isAdmin && headOrgIds.length === 0) {
    redirect("/projects");
  }

  const supabase = await createClient();
  const orgQuery = supabase.from("organizations").select("id, name").order("name");
  const [{ data: organizations }, { data: playbooks }] = await Promise.all([
    isAdmin ? orgQuery : orgQuery.in("id", headOrgIds),
    supabase.from("playbooks").select("id, name").order("name"),
  ]);

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">สร้างโครงการ</h1>
      <form
        action={createProjectAction}
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div>
          <label className="text-xs font-medium text-slate-500">องค์กร</label>
          <select
            name="organization_id"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">เลือกองค์กร</option>
            {(organizations ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">ชื่อโครงการ</label>
          <input
            name="name"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">คำอธิบาย</label>
          <textarea
            name="description"
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">
            รูปแบบการเริ่มโครงการ
          </label>
          <select
            name="playbook_id"
            defaultValue=""
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">เริ่มแบบว่าง — เพิ่มงานเอง</option>
            {(playbooks ?? []).map((playbook) => (
              <option key={playbook.id} value={playbook.id}>
                ใช้ร่างมาตรฐาน: {playbook.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            เลือกใช้ร่างมาตรฐานเฉพาะโครงการที่เหมาะสม หรือเริ่มว่างแล้วเพิ่มงานจริงภายหลังก็ได้
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500">วันเริ่มต้น</label>
            <input
              type="date"
              name="start_date"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">
              วันสิ้นสุด (เป้าหมาย)
            </label>
            <input
              type="date"
              name="target_date"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
        </div>
        <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white">
          สร้างโครงการ
        </button>
      </form>
    </div>
  );
}
