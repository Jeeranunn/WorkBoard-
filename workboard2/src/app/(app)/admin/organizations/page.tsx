import { createClient } from "@/lib/supabase/server";
import { createNetwork, createOrganization } from "../actions";

export default async function OrganizationsPage() {
  const supabase = await createClient();

  const [{ data: networks }, { data: organizations }] = await Promise.all([
    supabase.from("networks").select("id, name").order("name"),
    supabase
      .from("organizations")
      .select("id, name, network_id")
      .order("name"),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">โครงสร้างองค์กร</h1>
        <p className="text-sm text-slate-500">
          จัดการเครือข่ายและองค์กรภายใต้เครือข่าย
        </p>
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">เครือข่าย</h2>
          <ul className="mb-4 space-y-1 text-sm text-slate-700">
            {(networks ?? []).map((n) => (
              <li key={n.id}>{n.name}</li>
            ))}
            {(networks ?? []).length === 0 && (
              <li className="text-slate-400">ยังไม่มีเครือข่าย</li>
            )}
          </ul>
          <form action={createNetwork} className="flex gap-2">
            <input
              name="name"
              placeholder="ชื่อเครือข่าย"
              required
              className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
            >
              เพิ่ม
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">องค์กร</h2>
          <ul className="mb-4 space-y-1 text-sm text-slate-700">
            {(organizations ?? []).map((o) => (
              <li key={o.id}>{o.name}</li>
            ))}
            {(organizations ?? []).length === 0 && (
              <li className="text-slate-400">ยังไม่มีองค์กร</li>
            )}
          </ul>
          <form action={createOrganization} className="flex flex-col gap-2">
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
            <div className="flex gap-2">
              <input
                name="name"
                placeholder="ชื่อองค์กร"
                required
                className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
              >
                เพิ่ม
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
