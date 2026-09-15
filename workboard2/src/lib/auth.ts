import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/database.types";

export interface CurrentUser {
  personId: string;
  fullName: string;
  email: string;
  roles: AppRole[];
}

/**
 * Resolves the signed-in Supabase auth user to a `people` row and their
 * granted roles. Returns null when there is no session or no matching
 * person row yet (e.g. an auth user created before an admin linked them).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: person } = await supabase
    .from("people")
    .select("id, full_name, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!person) return null;

  const { data: roleRows } = await supabase
    .from("person_roles")
    .select("role")
    .eq("person_id", person.id);

  return {
    personId: person.id,
    fullName: person.full_name,
    email: person.email,
    roles: (roleRows ?? []).map((r) => r.role),
  };
}

export function hasRole(user: CurrentUser | null, role: AppRole): boolean {
  return user?.roles.includes(role) ?? false;
}

/**
 * Defense-in-depth check for admin-only pages/actions. This is a UX guard,
 * not the security boundary — Row Level Security (`is_admin()` policies)
 * is what actually enforces this in the database.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !hasRole(user, "ADMIN")) {
    throw new Error("ต้องเป็นผู้ดูแลระบบเท่านั้น");
  }
  return user;
}
