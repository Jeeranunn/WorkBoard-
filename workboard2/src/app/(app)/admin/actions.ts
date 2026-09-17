"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, TeamType } from "@/lib/database.types";

export interface AdminFormState {
  error: string | null;
  success?: string | null;
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalStr(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value === "" ? null : value;
}

async function runAdminInsert(
  table:
    | "networks"
    | "organizations"
    | "organization_units"
    | "positions"
    | "people"
    | "appointments"
    | "person_roles"
    | "teams"
    | "team_memberships",
  values: Record<string, unknown>,
  path: string,
  success: string,
): Promise<AdminFormState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from(table).insert(values as never);
  if (error) return { error: error.message };
  revalidatePath(path);
  return { error: null, success };
}

export async function createNetwork(
  _state: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const name = str(formData, "name");
  if (!name) return { error: "กรุณาใส่ชื่อเครือข่าย" };
  return runAdminInsert(
    "networks",
    { name },
    "/admin/organizations",
    "เพิ่มเครือข่ายแล้ว",
  );
}

export async function createOrganization(
  _state: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const name = str(formData, "name");
  const networkId = str(formData, "network_id");
  if (!name || !networkId) return { error: "กรุณาเลือกเครือข่ายและใส่ชื่อองค์กร" };
  return runAdminInsert(
    "organizations",
    { name, network_id: networkId },
    "/admin/organizations",
    "เพิ่มองค์กรแล้ว",
  );
}

export async function createUnit(
  _state: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const name = str(formData, "name");
  const organizationId = str(formData, "organization_id");
  const parentUnitId = optionalStr(formData, "parent_unit_id");
  if (!name || !organizationId) return { error: "กรุณาเลือกองค์กรและใส่ชื่อหน่วยงาน" };

  return runAdminInsert(
    "organization_units",
    {
      name,
      organization_id: organizationId,
      parent_unit_id: parentUnitId,
    },
    "/admin/units",
    "เพิ่มหน่วยงานแล้ว",
  );
}

export async function createPosition(
  _state: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const title = str(formData, "title");
  const unitId = str(formData, "unit_id");
  if (!title || !unitId) return { error: "กรุณาเลือกหน่วยงานและใส่ชื่อตำแหน่ง" };

  return runAdminInsert(
    "positions",
    { title, unit_id: unitId },
    "/admin/positions",
    "เพิ่มตำแหน่งแล้ว",
  );
}

export async function createTeam(
  _state: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const name = str(formData, "name");
  const networkId = str(formData, "network_id");
  const ownerOrganizationId = optionalStr(formData, "owner_organization_id");
  const teamType = str(formData, "team_type") as TeamType;
  if (!name || !networkId || !["WORKING", "PROJECT"].includes(teamType)) {
    return { error: "ข้อมูลทีมไม่ครบหรือประเภททีมไม่ถูกต้อง" };
  }

  return runAdminInsert(
    "teams",
    {
      name,
      network_id: networkId,
      owner_organization_id: ownerOrganizationId,
      team_type: teamType,
    },
    "/admin/teams",
    "เพิ่มทีมแล้ว",
  );
}

export async function createPerson(
  _state: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const fullName = str(formData, "full_name");
  const email = str(formData, "email").toLowerCase();
  if (!fullName || !email) return { error: "กรุณาใส่ชื่อและอีเมล" };

  return runAdminInsert(
    "people",
    { full_name: fullName, email },
    "/admin/members",
    "เพิ่มบุคลากรแล้ว",
  );
}

export async function createAppointment(
  _state: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const personId = str(formData, "person_id");
  const positionId = str(formData, "position_id");
  if (!personId || !positionId) return { error: "กรุณาเลือกบุคลากรและตำแหน่ง" };

  return runAdminInsert(
    "appointments",
    { person_id: personId, position_id: positionId },
    "/admin/members",
    "แต่งตั้งตำแหน่งแล้ว",
  );
}

export async function createPersonRole(
  _state: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const personId = str(formData, "person_id");
  const role = str(formData, "role") as AppRole;
  const organizationId = optionalStr(formData, "organization_id");
  if (!personId || !["ADMIN", "EXECUTIVE", "HEAD", "MEMBER"].includes(role)) {
    return { error: "ข้อมูลบทบาทไม่ถูกต้อง" };
  }

  const isGlobalRole = role === "ADMIN" || role === "EXECUTIVE";
  if (isGlobalRole && organizationId) {
    return { error: "ผู้ดูแลระบบ/ผู้บริหารเป็นบทบาทระดับระบบ ไม่ต้องเลือกองค์กร" };
  }
  if (!isGlobalRole && !organizationId) {
    return { error: "หัวหน้าฝ่าย/สมาชิกต้องระบุองค์กร" };
  }

  return runAdminInsert(
    "person_roles",
    { person_id: personId, role, organization_id: organizationId },
    "/admin/members",
    "มอบบทบาทแล้ว",
  );
}

export async function createTeamMembership(
  _state: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const personId = str(formData, "person_id");
  const teamId = str(formData, "team_id");
  const roleInTeam = optionalStr(formData, "role_in_team");
  if (!personId || !teamId) return { error: "กรุณาเลือกบุคลากรและทีม" };

  return runAdminInsert(
    "team_memberships",
    {
      person_id: personId,
      team_id: teamId,
      role_in_team: roleInTeam,
    },
    "/admin/members",
    "เพิ่มสมาชิกเข้าทีมแล้ว",
  );
}

async function endDatedRow(
  table: "organization_units" | "positions" | "appointments" | "person_roles" | "team_memberships",
  id: string,
  path: string,
  success: string,
): Promise<AdminFormState> {
  if (!id) return { error: "ไม่พบรายการ" };
  await requireAdmin();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from(table)
    .update({ valid_to: today } as never)
    .eq("id", id)
    .is("valid_to", null);
  if (error) return { error: error.message };
  revalidatePath(path);
  revalidatePath("/overview");
  revalidatePath("/head");
  revalidatePath("/member");
  return { error: null, success };
}

export async function endUnit(
  _state: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const id = str(formData, "id");
  if (!id) return { error: "ไม่พบหน่วยงาน" };
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("end_unit_lifecycle", {
    p_unit_id: id,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/units");
  revalidatePath("/admin/positions");
  revalidatePath("/admin/members");
  revalidatePath("/head");
  return { error: null, success: "สิ้นสุดหน่วยงานและโครงสร้างย่อยที่เกี่ยวข้องแล้ว" };
}

export async function endPosition(
  _state: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const id = str(formData, "id");
  if (!id) return { error: "ไม่พบตำแหน่ง" };
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("end_position_lifecycle", {
    p_position_id: id,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/positions");
  revalidatePath("/admin/members");
  revalidatePath("/head");
  return { error: null, success: "สิ้นสุดตำแหน่งและการแต่งตั้งที่เกี่ยวข้องแล้ว" };
}

export async function endAppointment(
  _state: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  return endDatedRow(
    "appointments",
    str(formData, "id"),
    "/admin/members",
    "สิ้นสุดการแต่งตั้งแล้ว",
  );
}

export async function endPersonRole(
  _state: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  return endDatedRow(
    "person_roles",
    str(formData, "id"),
    "/admin/members",
    "สิ้นสุดบทบาทแล้ว",
  );
}

export async function endTeamMembership(
  _state: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  return endDatedRow(
    "team_memberships",
    str(formData, "id"),
    "/admin/members",
    "สิ้นสุดสมาชิกภาพทีมแล้ว",
  );
}

async function setArchived(
  table: "networks" | "organizations" | "teams",
  id: string,
  active: boolean,
  path: string,
): Promise<AdminFormState> {
  if (!id) return { error: "ไม่พบรายการ" };
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from(table)
    .update({
      is_active: active,
      archived_at: active ? null : new Date().toISOString(),
    } as never)
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(path);
  revalidatePath("/overview");
  revalidatePath("/head");
  revalidatePath("/executive");
  return { error: null, success: active ? "เปิดใช้งานแล้ว" : "เก็บเข้าคลังแล้ว" };
}

export async function setNetworkActive(
  _state: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  return setArchived(
    "networks",
    str(formData, "id"),
    str(formData, "active") === "true",
    "/admin/organizations",
  );
}

export async function setOrganizationActive(
  _state: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  return setArchived(
    "organizations",
    str(formData, "id"),
    str(formData, "active") === "true",
    "/admin/organizations",
  );
}

export async function setTeamActive(
  _state: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  return setArchived(
    "teams",
    str(formData, "id"),
    str(formData, "active") === "true",
    "/admin/teams",
  );
}
