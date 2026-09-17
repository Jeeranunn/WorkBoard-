import { createClient } from "@/lib/supabase/server";
import {
  createAppointment,
  createPerson,
  createPersonRole,
  createTeamMembership,
  endAppointment,
  endPersonRole,
  endTeamMembership,
} from "../actions";
import { AdminActionForm } from "@/components/admin/action-form";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  HEAD: "หัวหน้าฝ่าย",
  MEMBER: "สมาชิก",
  EXECUTIVE: "ผู้บริหาร",
};

const GLOBAL_ROLES = new Set(["ADMIN", "EXECUTIVE"]);

export default async function MembersPage() {
  const supabase = await createClient();

  const [
    { data: people },
    { data: positions },
    { data: organizations },
    { data: roles },
    { data: teams },
    { data: memberships },
    { data: appointments },
  ] = await Promise.all([
    supabase.from("people").select("id, full_name, email").order("full_name"),
    supabase
      .from("positions")
      .select("id, title, valid_to")
      .order("title"),
    supabase
      .from("organizations")
      .select("id, name, is_active")
      .order("name"),
    supabase
      .from("person_roles")
      .select("id, person_id, role, organization_id, valid_from, valid_to")
      .order("created_at"),
    supabase
      .from("teams")
      .select("id, name, team_type, is_active")
      .order("name"),
    supabase
      .from("team_memberships")
      .select("id, person_id, team_id, role_in_team, valid_from, valid_to")
      .order("created_at"),
    supabase
      .from("appointments")
      .select("id, person_id, position_id, valid_from, valid_to")
      .order("created_at"),
  ]);

  const orgName = (id: string | null) =>
    (organizations ?? []).find((org) => org.id === id)?.name ?? "-";
  const positionName = (id: string) =>
    (positions ?? []).find((position) => position.id === id)?.title ?? "-";
  const teamName = (id: string) =>
    (teams ?? []).find((team) => team.id === id)?.name ?? "-";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">สมาชิกและบทบาท</h1>
        <p className="text-sm text-slate-500">
          บทบาท ตำแหน่ง และสมาชิกภาพทีมเก็บประวัติด้วยการสิ้นสุดช่วงเวลา ไม่ลบข้อมูลย้อนหลัง
        </p>
      </div>

      <div className="space-y-4">
        {(people ?? []).map((person) => {
          const personRoles = (roles ?? []).filter((role) => role.person_id === person.id);
          const personAppointments = (appointments ?? []).filter(
            (appointment) => appointment.person_id === person.id,
          );
          const personMemberships = (memberships ?? []).filter(
            (membership) => membership.person_id === person.id,
          );

          return (
            <section
              key={person.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div>
                <h2 className="font-semibold">{person.full_name}</h2>
                <p className="text-xs text-slate-500">{person.email}</p>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div>
                  <h3 className="text-xs font-semibold text-slate-500">บทบาท</h3>
                  <div className="mt-2 space-y-2">
                    {personRoles.map((role) => {
                      const label = ROLE_LABELS[role.role] ?? role.role;
                      const scope =
                        !GLOBAL_ROLES.has(role.role) && role.organization_id
                          ? ` · ${orgName(role.organization_id)}`
                          : "";
                      return (
                        <div key={role.id} className="rounded-md bg-slate-50 p-2 text-sm">
                          <div>
                            {label}{scope}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {role.valid_to ? `สิ้นสุด ${role.valid_to}` : "ใช้งานอยู่"}
                          </div>
                          {!role.valid_to && (
                            <AdminActionForm
                              action={endPersonRole}
                              submitLabel="สิ้นสุดบทบาท"
                              className="mt-2 space-y-1"
                              buttonClassName="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-60"
                            >
                              <input type="hidden" name="id" value={role.id} />
                            </AdminActionForm>
                          )}
                        </div>
                      );
                    })}
                    {personRoles.length === 0 && (
                      <p className="text-xs text-slate-400">ยังไม่มีบทบาท</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-500">ตำแหน่ง</h3>
                  <div className="mt-2 space-y-2">
                    {personAppointments.map((appointment) => (
                      <div key={appointment.id} className="rounded-md bg-slate-50 p-2 text-sm">
                        <div>{positionName(appointment.position_id)}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          {appointment.valid_to
                            ? `สิ้นสุด ${appointment.valid_to}`
                            : "ดำรงตำแหน่งอยู่"}
                        </div>
                        {!appointment.valid_to && (
                          <AdminActionForm
                            action={endAppointment}
                            submitLabel="สิ้นสุดการแต่งตั้ง"
                            className="mt-2 space-y-1"
                            buttonClassName="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-60"
                          >
                            <input type="hidden" name="id" value={appointment.id} />
                          </AdminActionForm>
                        )}
                      </div>
                    ))}
                    {personAppointments.length === 0 && (
                      <p className="text-xs text-slate-400">ยังไม่มีการแต่งตั้ง</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-500">ทีม</h3>
                  <div className="mt-2 space-y-2">
                    {personMemberships.map((membership) => (
                      <div key={membership.id} className="rounded-md bg-slate-50 p-2 text-sm">
                        <div>
                          {teamName(membership.team_id)}
                          {membership.role_in_team ? ` · ${membership.role_in_team}` : ""}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {membership.valid_to
                            ? `สิ้นสุด ${membership.valid_to}`
                            : "เป็นสมาชิกอยู่"}
                        </div>
                        {!membership.valid_to && (
                          <AdminActionForm
                            action={endTeamMembership}
                            submitLabel="ออกจากทีม"
                            className="mt-2 space-y-1"
                            buttonClassName="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-60"
                          >
                            <input type="hidden" name="id" value={membership.id} />
                          </AdminActionForm>
                        )}
                      </div>
                    ))}
                    {personMemberships.length === 0 && (
                      <p className="text-xs text-slate-400">ยังไม่มีทีม</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
        {(people ?? []).length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
            ยังไม่มีบุคลากร
          </div>
        )}
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">เพิ่มบุคลากร</h2>
          <AdminActionForm action={createPerson} submitLabel="เพิ่ม">
            <input
              name="full_name"
              placeholder="ชื่อ-นามสกุล"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            <input
              name="email"
              type="email"
              placeholder="อีเมล (ต้องตรงกับบัญชี Supabase Auth)"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </AdminActionForm>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">มอบบทบาท</h2>
          <p className="mb-2 text-xs text-slate-400">
            หัวหน้าฝ่าย/สมาชิกต้องเลือกองค์กร ส่วนผู้ดูแลระบบ/ผู้บริหารเป็นบทบาทระดับระบบ
          </p>
          <AdminActionForm action={createPersonRole} submitLabel="มอบบทบาท">
            <select
              name="person_id"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">เลือกบุคลากร</option>
              {(people ?? []).map((person) => (
                <option key={person.id} value={person.id}>
                  {person.full_name}
                </option>
              ))}
            </select>
            <select
              name="role"
              required
              defaultValue="MEMBER"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              name="organization_id"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">ไม่ระบุองค์กร (ADMIN / EXECUTIVE)</option>
              {(organizations ?? [])
                .filter((organization) => organization.is_active)
                .map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
            </select>
          </AdminActionForm>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">แต่งตั้งตำแหน่ง</h2>
          <AdminActionForm action={createAppointment} submitLabel="แต่งตั้ง">
            <select
              name="person_id"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">เลือกบุคลากร</option>
              {(people ?? []).map((person) => (
                <option key={person.id} value={person.id}>
                  {person.full_name}
                </option>
              ))}
            </select>
            <select
              name="position_id"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">เลือกตำแหน่ง</option>
              {(positions ?? [])
                .filter((position) => !position.valid_to)
                .map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.title}
                  </option>
                ))}
            </select>
          </AdminActionForm>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">เพิ่มเข้าทีม</h2>
          <AdminActionForm action={createTeamMembership} submitLabel="เพิ่มเข้าทีม">
            <select
              name="person_id"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">เลือกบุคลากร</option>
              {(people ?? []).map((person) => (
                <option key={person.id} value={person.id}>
                  {person.full_name}
                </option>
              ))}
            </select>
            <select
              name="team_id"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">เลือกทีม</option>
              {(teams ?? [])
                .filter((team) => team.is_active)
                .map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.team_type === "PROJECT" ? "ทีมโครงการ" : "ทีมปฏิบัติงาน"})
                  </option>
                ))}
            </select>
            <input
              name="role_in_team"
              placeholder="บทบาทในทีม (ถ้ามี)"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </AdminActionForm>
        </div>
      </section>
    </div>
  );
}
