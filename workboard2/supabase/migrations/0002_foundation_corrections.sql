-- WorkBoard 2.0 — Milestone 1.1: Foundation Schema Correction
--
-- Corrections to 0001_foundation.sql after schema review. 0001 has already
-- been pushed, so this migration only adds/alters forward — it never edits
-- 0001 itself. No production Supabase project has been provisioned yet, so
-- the DROP/CREATE below (teams unification) is safe: there is no real data
-- to lose.
--
-- Summary of corrections:
--   1. Teams unified into a single `teams` table (team_type WORKING|PROJECT)
--      with network_id + nullable owner_organization_id, so a team is never
--      forced into exactly one organization and membership is never
--      restricted by the team's owning org. Project linkage (many-to-many)
--      is deferred to Milestone 2 as a `team_projects` junction table, once
--      `projects` exists — see note near the bottom.
--   2. person_roles now distinguishes global roles (ADMIN/EXECUTIVE, must
--      have organization_id null) from scoped roles (HEAD/MEMBER, must have
--      organization_id set), with a has_role_in_organization() helper so a
--      HEAD of Org A can no longer pass a HEAD check for Org B.
--   3. Dropped the overly-broad self-update policy on `people` (it allowed
--      updating every column, including identity/auth linkage).
--   4. Added updated_at (+ trigger) across all tables, and is_active /
--      archived_at on networks/organizations (organization_units and
--      positions already had valid_from/valid_to for this).
--   5. Partial unique indexes prevent duplicate *active* appointments and
--      team memberships (a person can still hold many, just not the same
--      one twice at once).
--   6. A trigger enforces that organization_units.parent_unit_id belongs to
--      the same organization_id as the child unit.

-- ---------------------------------------------------------------------------
-- 1. Teams: unify working_teams/project_teams into `teams`
-- ---------------------------------------------------------------------------
drop policy if exists "admin write" on team_memberships;
drop policy if exists "authenticated read" on team_memberships;
drop table if exists team_memberships;

drop policy if exists "admin write" on project_teams;
drop policy if exists "authenticated read" on project_teams;
drop table if exists project_teams;

drop policy if exists "admin write" on working_teams;
drop policy if exists "authenticated read" on working_teams;
drop table if exists working_teams;

alter type team_kind rename to team_type_enum;

create table teams (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references networks (id) on delete restrict,
  -- Administrative "home" org for the team. Nullable and never used to
  -- restrict membership — a team's members may come from any organization.
  owner_organization_id uuid references organizations (id) on delete set null,
  team_type team_type_enum not null,
  name text not null,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  person_id uuid not null references people (id) on delete cascade,
  role_in_team text,
  valid_from date not null default current_date,
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_memberships_valid_range check (valid_to is null or valid_to >= valid_from)
);

-- One active (valid_to is null) membership per person per team; the same
-- person can still join a different team, or rejoin after their prior
-- membership row has been ended (valid_to set).
create unique index team_memberships_active_unique
  on team_memberships (team_id, person_id)
  where valid_to is null;

alter table teams enable row level security;
alter table team_memberships enable row level security;

create policy "authenticated read" on teams for select using (auth.uid() is not null);
create policy "admin write" on teams for all using (is_admin()) with check (is_admin());

create policy "authenticated read" on team_memberships for select using (auth.uid() is not null);
create policy "admin write" on team_memberships for all using (is_admin()) with check (is_admin());

-- Milestone 2 note: once `projects` exists, add a `team_projects` junction
-- table (team_id, project_id, valid_from/valid_to) instead of a project_id
-- column on `teams`. This supports one team on many projects, one project
-- with many teams, and a project-dedicated team (a team linked to exactly
-- one project) without changing team identity.

-- ---------------------------------------------------------------------------
-- 2. Role scope: distinguish global roles from org-scoped roles
-- ---------------------------------------------------------------------------
alter table person_roles
  drop constraint if exists person_roles_person_id_role_organization_id_key;

alter table person_roles
  add constraint person_roles_scope_check check (
    (role in ('ADMIN', 'EXECUTIVE') and organization_id is null)
    or
    (role in ('HEAD', 'MEMBER') and organization_id is not null)
  );

-- Postgres treats NULLs as distinct in a plain UNIQUE constraint, so the
-- dropped constraint above never actually stopped duplicate global role
-- grants (organization_id null). Two partial indexes cover both cases.
create unique index person_roles_global_unique
  on person_roles (person_id, role)
  where organization_id is null;

create unique index person_roles_scoped_unique
  on person_roles (person_id, role, organization_id)
  where organization_id is not null;

-- Scoped check: does the current person hold check_role specifically within
-- org_id? Use this (not has_role()) for any per-organization permission,
-- e.g. "can this person manage projects in organization X".
create function has_role_in_organization(check_role app_role, org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from person_roles
    where person_id = current_person_id()
      and role = check_role
      and organization_id = org_id
  );
$$;

create function is_executive()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_role('EXECUTIVE');
$$;

-- Extension note: to support role scope at the unit/team/project level
-- later, add nullable unit_id/team_id/project_id columns here (a future
-- migration, once those relationships need row-level scoping beyond org),
-- with a CHECK that at most one scope column is set, and a matching
-- has_role_in_unit()/has_role_in_team()/has_role_in_project() helper per
-- new scope. Global roles (ADMIN/EXECUTIVE) stay defined as "every scope
-- column is null".

-- ---------------------------------------------------------------------------
-- 3. Restrict self-update on people
-- ---------------------------------------------------------------------------
-- The previous policy allowed a signed-in user to update *any* column on
-- their own `people` row, including full_name/email/auth_user_id — i.e.
-- their own identity/permission-linked record. There is currently no
-- self-service profile field that is safe to expose this way, so the
-- policy is dropped rather than narrowed. When a genuinely self-editable
-- field is introduced (e.g. a phone number or avatar), add it via a
-- SECURITY DEFINER function that updates only that column, not a row-wide
-- UPDATE policy.
drop policy if exists "self update" on people;

-- ---------------------------------------------------------------------------
-- 4. Lifecycle fields: updated_at everywhere, is_active/archived_at where
--    there was no existing lifecycle mechanism (organization_units and
--    positions already have valid_from/valid_to).
-- ---------------------------------------------------------------------------
alter table networks add column updated_at timestamptz not null default now();
alter table networks add column is_active boolean not null default true;
alter table networks add column archived_at timestamptz;

alter table organizations add column updated_at timestamptz not null default now();
alter table organizations add column is_active boolean not null default true;
alter table organizations add column archived_at timestamptz;

alter table organization_units add column updated_at timestamptz not null default now();
alter table positions add column updated_at timestamptz not null default now();
alter table people add column updated_at timestamptz not null default now();
alter table appointments add column updated_at timestamptz not null default now();
alter table person_roles add column updated_at timestamptz not null default now();

create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on networks
  for each row execute function set_updated_at();
create trigger set_updated_at before update on organizations
  for each row execute function set_updated_at();
create trigger set_updated_at before update on organization_units
  for each row execute function set_updated_at();
create trigger set_updated_at before update on positions
  for each row execute function set_updated_at();
create trigger set_updated_at before update on people
  for each row execute function set_updated_at();
create trigger set_updated_at before update on appointments
  for each row execute function set_updated_at();
create trigger set_updated_at before update on person_roles
  for each row execute function set_updated_at();
create trigger set_updated_at before update on teams
  for each row execute function set_updated_at();
create trigger set_updated_at before update on team_memberships
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Prevent duplicate active appointments
-- ---------------------------------------------------------------------------
-- A person can hold many appointments, just not the identical
-- person+position pair twice while both are active.
create unique index appointments_active_unique
  on appointments (person_id, position_id)
  where valid_to is null;

-- ---------------------------------------------------------------------------
-- 6. organization_units: parent_unit_id must stay within the same org
-- ---------------------------------------------------------------------------
-- A CHECK constraint can't reference other rows, so this needs a trigger.
create function check_unit_parent_same_org()
returns trigger
language plpgsql
as $$
begin
  if new.parent_unit_id is not null then
    if not exists (
      select 1 from organization_units
      where id = new.parent_unit_id
        and organization_id = new.organization_id
    ) then
      raise exception 'organization_units.parent_unit_id must belong to the same organization_id';
    end if;
  end if;
  return new;
end;
$$;

create trigger organization_units_parent_same_org
  before insert or update on organization_units
  for each row execute function check_unit_parent_same_org();

-- ---------------------------------------------------------------------------
-- Rollback (manual, additive except for the teams unification):
--
-- drop trigger if exists organization_units_parent_same_org on organization_units;
-- drop function if exists check_unit_parent_same_org();
-- drop index if exists appointments_active_unique;
-- drop trigger if exists set_updated_at on team_memberships;
-- drop trigger if exists set_updated_at on teams;
-- drop trigger if exists set_updated_at on person_roles;
-- drop trigger if exists set_updated_at on appointments;
-- drop trigger if exists set_updated_at on people;
-- drop trigger if exists set_updated_at on positions;
-- drop trigger if exists set_updated_at on organization_units;
-- drop trigger if exists set_updated_at on organizations;
-- drop trigger if exists set_updated_at on networks;
-- drop function if exists set_updated_at();
-- alter table person_roles drop column updated_at;
-- alter table appointments drop column updated_at;
-- alter table people drop column updated_at;
-- alter table positions drop column updated_at;
-- alter table organization_units drop column updated_at;
-- alter table organizations drop column archived_at, drop column is_active, drop column updated_at;
-- alter table networks drop column archived_at, drop column is_active, drop column updated_at;
-- create policy "self update" on people for update
--   using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
-- drop function if exists is_executive();
-- drop function if exists has_role_in_organization(app_role, uuid);
-- drop index if exists person_roles_scoped_unique;
-- drop index if exists person_roles_global_unique;
-- alter table person_roles drop constraint if exists person_roles_scope_check;
-- alter table person_roles add constraint person_roles_person_id_role_organization_id_key unique (person_id, role, organization_id);
-- drop table if exists team_memberships;
-- drop table if exists teams;
-- alter type team_type_enum rename to team_kind;
-- (working_teams/project_teams would need to be recreated from scratch — not reversible from teams alone)
