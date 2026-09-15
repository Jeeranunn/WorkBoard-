"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, TeamType } from "@/lib/database.types";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalStr(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value === "" ? null : value;
}

export async function createNetwork(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const name = str(formData, "name");
  if (!name) return;

  const { error } = await supabase.from("networks").insert({ name });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/organizations");
}

export async function createOrganization(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const name = str(formData, "name");
  const networkId = str(formData, "network_id");
  if (!name || !networkId) return;

  const { error } = await supabase
    .from("organizations")
    .insert({ name, network_id: networkId });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/organizations");
}

export async function createUnit(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const name = str(formData, "name");
  const organizationId = str(formData, "organization_id");
  const parentUnitId = optionalStr(formData, "parent_unit_id");
  if (!name || !organizationId) return;

  const { error } = await supabase.from("organization_units").insert({
    name,
    organization_id: organizationId,
    parent_unit_id: parentUnitId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/units");
}

export async function createPosition(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const title = str(formData, "title");
  const unitId = str(formData, "unit_id");
  if (!title || !unitId) return;

  const { error } = await supabase
    .from("positions")
    .insert({ title, unit_id: unitId });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/positions");
}

export async function createTeam(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const name = str(formData, "name");
  const networkId = str(formData, "network_id");
  const ownerOrganizationId = optionalStr(formData, "owner_organization_id");
  const teamType = str(formData, "team_type") as TeamType;
  if (!name || !networkId || !teamType) return;

  const { error } = await supabase.from("teams").insert({
    name,
    network_id: networkId,
    owner_organization_id: ownerOrganizationId,
    team_type: teamType,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/teams");
}

export async function createPerson(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const fullName = str(formData, "full_name");
  const email = str(formData, "email");
  if (!fullName || !email) return;

  const { error } = await supabase
    .from("people")
    .insert({ full_name: fullName, email });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/members");
}

export async function createAppointment(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const personId = str(formData, "person_id");
  const positionId = str(formData, "position_id");
  if (!personId || !positionId) return;

  const { error } = await supabase
    .from("appointments")
    .insert({ person_id: personId, position_id: positionId });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/members");
}

export async function createPersonRole(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const personId = str(formData, "person_id");
  const role = str(formData, "role") as AppRole;
  const organizationId = optionalStr(formData, "organization_id");
  if (!personId || !role) return;

  const isGlobalRole = role === "ADMIN" || role === "EXECUTIVE";
  if (isGlobalRole && organizationId) {
    throw new Error(
      "ผู้ดูแลระบบ/ประธาน เป็นบทบาทระดับองค์กรทั้งหมด ไม่ต้องเลือกองค์กร",
    );
  }
  if (!isGlobalRole && !organizationId) {
    throw new Error("บทบาทนี้ต้องระบุองค์กร");
  }

  const { error } = await supabase
    .from("person_roles")
    .insert({ person_id: personId, role, organization_id: organizationId });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/members");
}

export async function createTeamMembership(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const personId = str(formData, "person_id");
  const teamId = str(formData, "team_id");
  const roleInTeam = optionalStr(formData, "role_in_team");
  if (!personId || !teamId) return;

  const { error } = await supabase.from("team_memberships").insert({
    person_id: personId,
    team_id: teamId,
    role_in_team: roleInTeam,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/members");
}
