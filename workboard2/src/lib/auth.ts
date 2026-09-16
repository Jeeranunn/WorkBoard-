import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { timed } from "@/lib/server-timing";
import type { AppRole } from "@/lib/database.types";

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

  const { data } = await timed("current_user_context (query)", () =>
    supabase.rpc("current_user_context"),
  );

  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const raw = data as {
    person_id?: unknown;
    full_name?: unknown;
    email?: unknown;
    roles?: unknown;
  };

  if (
    typeof raw.person_id !== "string" ||
    typeof raw.full_name !== "string" ||
    typeof raw.email !== "string"
  ) {
    return null;
  }

  const roles = Array.isArray(raw.roles)
    ? raw.roles.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const role = (item as { role?: unknown }).role;
        const organizationId = (item as { organization_id?: unknown }).organization_id;

        if (
          !["ADMIN", "EXECUTIVE", "HEAD", "MEMBER"].includes(String(role)) ||
          !(organizationId === null || typeof organizationId === "string")
        ) {
          return [];
        }

        return [
          {
            role: String(role) as AppRole,
            organizationId: organizationId as string | null,
          },
        ];
      })
    : [];

  return {
    personId: raw.person_id,
    fullName: raw.full_name,
    email: raw.email,
    roles,
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
