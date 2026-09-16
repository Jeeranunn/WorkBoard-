import { createClient } from "@/lib/supabase/server";
import {
  createNetwork,
  createOrganization,
  setNetworkActive,
  setOrganizationActive,
} from "../actions";
import { AdminActionForm } from "@/components/admin/action-form";

export default async function OrganizationsPage() {
  const supabase = await createClient();

  const [{ data: networks }, { data: organizations }] = await Promise.all([
    supabase.from("networks").select("id, name, is_active").order("name"),
    supabase
      .from("organizations")
      .select("id, name, network_id, is_active")
      .order("name"),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">โครงสร้างองค์กร</h1>
        <p className="text-sm text-slate-500">
          จัดการเครือข่ายและองค์กรโดยเก็บประวัติด้วยการปิดใช้งานแทนการลบ
        </p>
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">เครือข่าย</h2>
          <div className="mb-4 space-y-2">
            {(networks ?? []).map((network) => (
              <div
                key={network.id}
                className="flex items-center justify-between gap-3 rounded-md border border-slate-100 p-2 text-sm"
              >
                <div>
                  <div className="font-medium">{network.name}</div>
                  <div className="text-xs text-slate-400">
                    {network.is_active ? "ใช้งานอยู่" : "เก็บเข้าคลังแล้ว"}
                  </div>
                </div>
                <AdminActionForm
                  action={setNetworkActive}
                  submitLabel={network.is_active ? "เก็บเข้าคลัง" : "เปิดใช้งาน"}
                  pendingLabel="กำลังบันทึก..."
                  className="space-y-1"
                  buttonClassName="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-60"
                >
                  <input type="hidden" name="id" value={network.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={network.is_active ? "false" : "true"}
                  />
                </AdminActionForm>
              </div>
            ))}
            {(networks ?? []).length === 0 && (
              <p className="text-sm text-slate-400">ยังไม่มีเครือข่าย</p>
            )}
          </div>

          <AdminActionForm
            action={createNetwork}
            submitLabel="เพิ่ม"
            className="flex flex-col gap-2"
          >
            <input
              name="name"
              placeholder="ชื่อเครือข่าย"
              required
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </AdminActionForm>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">องค์กร</h2>
          <div className="mb-4 space-y-2">
            {(organizations ?? []).map((organization) => (
              <div
                key={organization.id}
                className="flex items-center justify-between gap-3 rounded-md border border-slate-100 p-2 text-sm"
              >
                <div>
                  <div className="font-medium">{organization.name}</div>
                  <div className="text-xs text-slate-400">
                    {(networks ?? []).find((n) => n.id === organization.network_id)?.name ?? "-"}
                    {" · "}
                    {organization.is_active ? "ใช้งานอยู่" : "เก็บเข้าคลังแล้ว"}
                  </div>
                </div>
                <AdminActionForm
                  action={setOrganizationActive}
                  submitLabel={organization.is_active ? "เก็บเข้าคลัง" : "เปิดใช้งาน"}
                  pendingLabel="กำลังบันทึก..."
                  className="space-y-1"
                  buttonClassName="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-60"
                >
                  <input type="hidden" name="id" value={organization.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={organization.is_active ? "false" : "true"}
                  />
                </AdminActionForm>
              </div>
            ))}
            {(organizations ?? []).length === 0 && (
              <p className="text-sm text-slate-400">ยังไม่มีองค์กร</p>
            )}
          </div>

          <AdminActionForm
            action={createOrganization}
            submitLabel="เพิ่ม"
            className="flex flex-col gap-2"
          >
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
            <input
              name="name"
              placeholder="ชื่อองค์กร"
              required
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </AdminActionForm>
        </div>
      </section>
    </div>
  );
}
