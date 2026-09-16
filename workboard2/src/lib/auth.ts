import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { timed } from "@/lib/server-timing";
import type { AppRole } from "@/lib/database.types";
import { bangkokTodayKey } from "@/lib/date-time";

export interface RoleGrant {
  role: AppRole;
  organizationId: string | null;
}

export interface CurrentUser {
  personId: string;
  fullName: string;
  email: string;
  roles: RoleGrant[];
}

/**
 * Verified auth identity for Server Components.
 *
 * getClaims() validates the JWT signature. With Supabase's default asymmetric
 * signing keys it normally avoids the Auth server round-trip required by
 * getUser(), which removes a repeated network hop from every navigation.
 * React cache() keeps this request-scoped.
 */
export const getAuthUser = cache(async () => {
  return timed("auth.getClaims (RSC)", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const subject = !error ? data?.claims?.sub : null;
    return subject ? { id: subject } : null;
  });
});

/**
 * Resolves the signed-in Supabase auth user to a `people` row and their
 * granted roles. Returns null when there is no session or no matching
 * person row yet (e.g. an auth user created before an admin linked them).
 *
 * Wrapped in cache() for the same reason as getAuthUser(): every route's
 * page.tsx (plus the shared layout) calls this once each, so without
 * memoization a single request re-ran the auth check, the `people` lookup,
 * and the `person_roles` lookup once per segment. cache() collapses all of
 * that to one round trip per query, per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createClient();

  const { data: person } = await timed("people lookup (query)", () =>
    supabase
      .from("people")
      .select("id, full_name, email")
      .eq("auth_user_id", user.id)
      .maybeSingle(),
  );

  if (!person) return null;

  const today = bangkokTodayKey();

  const { data: roleRows } = await timed("person_roles lookup (query)", () =>
    supabase
      .from("person_roles")
      .select("role, organization_id")
      .eq("person_id", person.id)
      .lte("valid_from", today)
      .or(`valid_to.is.null,valid_to.gte.${today}`),
  );

  return {
    personId: person.id,
    fullName: person.full_name,
    email: person.email,
    roles: (roleRows ?? []).map((r) => ({
      role: r.role,
      organizationId: r.organization_id,
    })),
  };
});

/**
 * Global role check (ADMIN/EXECUTIVE only — these always have
 * organization_id null, per the DB CHECK constraint). Do not use this for
 * HEAD/MEMBER: those are org-scoped, so use `hasRoleInOrganization` instead
 * — a HEAD of Organization A must not pass a check meant for Organization B.
 */
export function hasRole(user: CurrentUser | null, role: AppRole): boolean {
  return user?.roles.some((r) => r.role === role) ?? false;
}

export function hasRoleInOrganization(
  user: CurrentUser | null,
  role: AppRole,
  organizationId: string,
): boolean {
  return (
    user?.roles.some(
      (r) => r.role === role && r.organizationId === organizationId,
    ) ?? false
  );
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
