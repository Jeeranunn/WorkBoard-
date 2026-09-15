-- WorkBoard 2.0 — Milestone 1: Foundation
-- Organization structure, positions/appointments (with history), teams, roles.
--
-- Non-destructive: this migration only creates new objects. It never touches
-- the legacy Firestore data and can be rolled back safely by dropping the
-- objects created here (see bottom of file for the rollback script, kept as
-- a comment for reference).

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type app_role as enum ('ADMIN', 'HEAD', 'MEMBER', 'EXECUTIVE');
create type team_kind as enum ('WORKING', 'PROJECT');

-- ---------------------------------------------------------------------------
-- Organization structure (Network -> Organization -> Unit -> Position)
-- Units and positions keep valid_from/valid_to to preserve history instead
-- of destructive edits.
-- ---------------------------------------------------------------------------
create table networks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table organizations (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references networks (id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now()
);

create table organization_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  parent_unit_id uuid references organization_units (id) on delete restrict,
  name text not null,
  valid_from date not null default current_date,
  valid_to date,
  created_at timestamptz not null default now(),
  constraint organization_units_valid_range check (valid_to is null or valid_to >= valid_from)
);

create table positions (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references organization_units (id) on delete restrict,
  title text not null,
  valid_from date not null default current_date,
  valid_to date,
  created_at timestamptz not null default now(),
  constraint positions_valid_range check (valid_to is null or valid_to >= valid_from)
);

-- ---------------------------------------------------------------------------
-- People and appointments
-- A person maps 1:1 to a Supabase auth user, but can hold many appointments
-- (positions) at once and over time — no single-role / single-dept assumption.
-- ---------------------------------------------------------------------------
create table people (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  full_name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people (id) on delete cascade,
  position_id uuid not null references positions (id) on delete restrict,
  valid_from date not null default current_date,
  valid_to date,
  created_at timestamptz not null default now(),
  constraint appointments_valid_range check (valid_to is null or valid_to >= valid_from)
);

-- Explicit role grants, decoupled from org hierarchy/appointments so a
-- person can hold multiple roles/scopes simultaneously.
create table person_roles (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people (id) on delete cascade,
  role app_role not null,
  organization_id uuid references organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (person_id, role, organization_id)
);

-- ---------------------------------------------------------------------------
-- Teams — independent of the org hierarchy. A working team is standing
-- (e.g. a cross-department task force); a project team is scoped to a
-- project. A person can belong to many teams at once.
-- ---------------------------------------------------------------------------
create table working_teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now()
);

create table project_teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now()
);

create table team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_kind team_kind not null,
  working_team_id uuid references working_teams (id) on delete cascade,
  project_team_id uuid references project_teams (id) on delete cascade,
  person_id uuid not null references people (id) on delete cascade,
  role_in_team text,
  valid_from date not null default current_date,
  valid_to date,
  created_at timestamptz not null default now(),
  constraint team_memberships_valid_range check (valid_to is null or valid_to >= valid_from),
  constraint team_memberships_team_ref check (
    (team_kind = 'WORKING' and working_team_id is not null and project_team_id is null) or
    (team_kind = 'PROJECT' and project_team_id is not null and working_team_id is null)
  )
);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer) used by RLS policies below.
-- These centralize the "who am I / what can I do" checks server-side so
-- authorization never relies on client-side role checks.
-- ---------------------------------------------------------------------------
create function current_person_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from people where auth_user_id = auth.uid();
$$;

create function has_role(check_role app_role)
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
  );
$$;

create function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_role('ADMIN');
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Read: any authenticated person with a `people` row.
-- Write: ADMIN role only, for Milestone 1 (org structure management is an
-- admin-only feature per CLAUDE.md).
-- ---------------------------------------------------------------------------
alter table networks enable row level security;
alter table organizations enable row level security;
alter table organization_units enable row level security;
alter table positions enable row level security;
alter table people enable row level security;
alter table appointments enable row level security;
alter table person_roles enable row level security;
alter table working_teams enable row level security;
alter table project_teams enable row level security;
alter table team_memberships enable row level security;

create policy "authenticated read" on networks for select using (auth.uid() is not null);
create policy "admin write" on networks for all using (is_admin()) with check (is_admin());

create policy "authenticated read" on organizations for select using (auth.uid() is not null);
create policy "admin write" on organizations for all using (is_admin()) with check (is_admin());

create policy "authenticated read" on organization_units for select using (auth.uid() is not null);
create policy "admin write" on organization_units for all using (is_admin()) with check (is_admin());

create policy "authenticated read" on positions for select using (auth.uid() is not null);
create policy "admin write" on positions for all using (is_admin()) with check (is_admin());

create policy "authenticated read" on people for select using (auth.uid() is not null);
create policy "admin write" on people for all using (is_admin()) with check (is_admin());
create policy "self update" on people for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy "authenticated read" on appointments for select using (auth.uid() is not null);
create policy "admin write" on appointments for all using (is_admin()) with check (is_admin());

create policy "self read roles" on person_roles for select
  using (person_id = current_person_id() or is_admin());
create policy "admin write" on person_roles for all using (is_admin()) with check (is_admin());

create policy "authenticated read" on working_teams for select using (auth.uid() is not null);
create policy "admin write" on working_teams for all using (is_admin()) with check (is_admin());

create policy "authenticated read" on project_teams for select using (auth.uid() is not null);
create policy "admin write" on project_teams for all using (is_admin()) with check (is_admin());

create policy "authenticated read" on team_memberships for select using (auth.uid() is not null);
create policy "admin write" on team_memberships for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Rollback (manual, non-destructive by default since this is additive-only):
--
-- drop table if exists team_memberships;
-- drop table if exists project_teams;
-- drop table if exists working_teams;
-- drop table if exists person_roles;
-- drop table if exists appointments;
-- drop table if exists people;
-- drop table if exists positions;
-- drop table if exists organization_units;
-- drop table if exists organizations;
-- drop table if exists networks;
-- drop function if exists is_admin();
-- drop function if exists has_role(app_role);
-- drop function if exists current_person_id();
-- drop type if exists team_kind;
-- drop type if exists app_role;
