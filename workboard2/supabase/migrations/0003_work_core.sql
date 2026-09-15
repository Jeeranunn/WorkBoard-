-- WorkBoard 2.0 — Milestone 2: Work Core
-- Projects, Workstreams, Milestones, Tasks/Subtasks, Dependencies,
-- Team<->Project linkage, and task change history.
--
-- Additive only: does not modify 0001_foundation.sql or
-- 0002_foundation_corrections.sql.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type project_status as enum ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- Manually set by HEAD/ADMIN for now. Milestone 4 (Project Completeness /
-- Playbook v0) is expected to replace or augment this with a computed
-- signal derived from task status distribution and planned-vs-added work,
-- per CLAUDE.md's rule against deriving progress from task count alone.
create type project_health as enum ('ON_TRACK', 'AT_RISK', 'OFF_TRACK');

create type milestone_status as enum ('PLANNED', 'IN_PROGRESS', 'ACHIEVED', 'MISSED', 'CANCELLED');

-- Classifies a workstream/milestone/task relative to the project's original
-- plan. Deliberately does NOT include a "planning gap" value: a planning gap
-- is the *absence* of an expected item (e.g. a speaker with no coordination
-- task), which can't be represented by a row that exists — detecting gaps
-- against a Playbook template is a Milestone 4 concern that reads this
-- column, not a value it stores.
create type work_origin as enum ('PLANNED', 'ADDED', 'SCOPE_CHANGE');

-- The 9-state minimum from CLAUDE.md plus CANCELLED, which is not part of
-- that list but is added here because real work needs a way to abandon a
-- task without falsely marking it COMPLETED.
create type task_status as enum (
  'ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'SUBMITTED', 'IN_REVIEW',
  'REVISION_REQUIRED', 'RESUBMITTED', 'APPROVED', 'COMPLETED', 'CANCELLED'
);

create type priority_level as enum ('P1', 'P2', 'P3', 'P4');

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create table projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  owner_person_id uuid not null references people (id) on delete restrict,
  name text not null,
  description text,
  status project_status not null default 'PLANNING',
  health project_health not null default 'ON_TRACK',
  start_date date,
  target_date date,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_organization_id_idx on projects (organization_id);

-- ---------------------------------------------------------------------------
-- Workstreams — grouping within a project, manually orderable.
-- ---------------------------------------------------------------------------
create table workstreams (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  name text not null,
  owner_person_id uuid references people (id) on delete set null,
  sort_order integer not null default 0,
  work_origin work_origin not null default 'PLANNED',
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workstreams_project_id_idx on workstreams (project_id);

-- ---------------------------------------------------------------------------
-- Milestones — belong to a project, optionally to one of its workstreams.
-- ---------------------------------------------------------------------------
create table milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  workstream_id uuid references workstreams (id) on delete set null,
  name text not null,
  target_date date,
  status milestone_status not null default 'PLANNED',
  work_origin work_origin not null default 'PLANNED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index milestones_project_id_idx on milestones (project_id);

create function check_milestone_workstream_same_project()
returns trigger
language plpgsql
as $$
begin
  if new.workstream_id is not null then
    if not exists (
      select 1 from workstreams
      where id = new.workstream_id
        and project_id = new.project_id
    ) then
      raise exception 'milestones.workstream_id must belong to the same project_id';
    end if;
  end if;
  return new;
end;
$$;

create trigger milestones_workstream_same_project
  before insert or update on milestones
  for each row execute function check_milestone_workstream_same_project();

-- ---------------------------------------------------------------------------
-- Tasks / Subtasks (self-referencing via parent_task_id)
-- ---------------------------------------------------------------------------
create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  workstream_id uuid references workstreams (id) on delete set null,
  milestone_id uuid references milestones (id) on delete set null,
  parent_task_id uuid references tasks (id) on delete cascade,

  title text not null,
  description text,
  deliverable text,
  completion_criteria text,
  source text,
  work_origin work_origin not null default 'PLANNED',

  status task_status not null default 'ASSIGNED',

  assignee_person_id uuid not null references people (id) on delete restrict,
  reviewer_person_id uuid references people (id) on delete set null,
  approver_person_id uuid references people (id) on delete set null,
  -- Maintained exclusively by the compute_task_current_holder() trigger
  -- below — never trust a client-supplied value for this column.
  current_holder_person_id uuid not null references people (id) on delete restrict,

  deadline timestamptz,
  estimated_hours numeric(6, 2),

  -- Importance/urgency stored separately per CLAUDE.md; priority is derived
  -- from them so it can never drift out of sync with the two flags.
  is_important boolean not null default true,
  is_urgent boolean not null default false,
  priority priority_level generated always as (
    case
      when is_important and is_urgent then 'P1'
      when is_important and not is_urgent then 'P2'
      when not is_important and is_urgent then 'P3'
      else 'P4'
    end
  ) stored,

  -- Composite states layered on top of `status`, not replacing it — a task
  -- can be IN_PROGRESS and blocked at the same time. `overdue` is
  -- deliberately not a column: it's a pure function of deadline + status,
  -- computed at query time (see is_task_overdue() below) rather than a
  -- cached flag that could go stale.
  is_blocked boolean not null default false,
  blocked_reason text,
  is_waiting boolean not null default false,
  waiting_reason text,
  is_on_hold boolean not null default false,
  on_hold_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_project_id_idx on tasks (project_id);
create index tasks_workstream_id_idx on tasks (workstream_id);
create index tasks_milestone_id_idx on tasks (milestone_id);
create index tasks_parent_task_id_idx on tasks (parent_task_id);
create index tasks_assignee_person_id_idx on tasks (assignee_person_id);
create index tasks_current_holder_person_id_idx on tasks (current_holder_person_id);
create index tasks_status_idx on tasks (status);

-- Pure function, not a stored column: a task is overdue if it has a
-- deadline in the past and hasn't reached a terminal state.
create function is_task_overdue(check_task_id uuid)
returns boolean
language sql
stable
as $$
  select deadline < now() and status not in ('APPROVED', 'COMPLETED', 'CANCELLED')
  from tasks
  where id = check_task_id;
$$;

-- Consistency checks: no parent cycle, and project_id must agree with
-- whichever parent/workstream/milestone the task references (same pattern
-- as organization_units.parent_unit_id in 0002).
create function check_task_consistency()
returns trigger
language plpgsql
as $$
declare
  walk_id uuid;
begin
  if new.parent_task_id is not null then
    if new.parent_task_id = new.id then
      raise exception 'a task cannot be its own parent';
    end if;

    if not exists (
      select 1 from tasks where id = new.parent_task_id and project_id = new.project_id
    ) then
      raise exception 'tasks.project_id must match parent_task_id''s project_id';
    end if;

    walk_id := new.parent_task_id;
    while walk_id is not null loop
      if walk_id = new.id then
        raise exception 'parent_task_id would create a cycle';
      end if;
      select parent_task_id into walk_id from tasks where id = walk_id;
    end loop;
  end if;

  if new.workstream_id is not null then
    if not exists (
      select 1 from workstreams where id = new.workstream_id and project_id = new.project_id
    ) then
      raise exception 'tasks.project_id must match workstream_id''s project_id';
    end if;
  end if;

  if new.milestone_id is not null then
    if not exists (
      select 1 from milestones where id = new.milestone_id and project_id = new.project_id
    ) then
      raise exception 'tasks.project_id must match milestone_id''s project_id';
    end if;
  end if;

  return new;
end;
$$;

create trigger tasks_check_consistency
  before insert or update on tasks
  for each row execute function check_task_consistency();

-- Current Action Holder: always recomputed server-side from status +
-- assignee/reviewer/approver, so it can never silently drift from the
-- workflow. Blocked/waiting/on-hold do not change the holder — they
-- describe why the current holder hasn't moved yet, not who's next.
create function compute_task_current_holder()
returns trigger
language plpgsql
as $$
begin
  new.current_holder_person_id := case new.status
    when 'SUBMITTED' then coalesce(new.reviewer_person_id, new.approver_person_id, new.assignee_person_id)
    when 'IN_REVIEW' then coalesce(new.reviewer_person_id, new.approver_person_id, new.assignee_person_id)
    when 'RESUBMITTED' then coalesce(new.reviewer_person_id, new.approver_person_id, new.assignee_person_id)
    else new.assignee_person_id
  end;
  return new;
end;
$$;

create trigger tasks_compute_current_holder
  before insert or update on tasks
  for each row execute function compute_task_current_holder();

-- ---------------------------------------------------------------------------
-- Task collaborators (many-to-many, beyond the single assignee)
-- ---------------------------------------------------------------------------
create table task_collaborators (
  task_id uuid not null references tasks (id) on delete cascade,
  person_id uuid not null references people (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, person_id)
);

-- ---------------------------------------------------------------------------
-- Task dependencies (many-to-many; predecessor must finish before successor)
-- ---------------------------------------------------------------------------
create table task_dependencies (
  predecessor_task_id uuid not null references tasks (id) on delete cascade,
  successor_task_id uuid not null references tasks (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (predecessor_task_id, successor_task_id),
  constraint task_dependencies_no_self_reference check (predecessor_task_id <> successor_task_id)
);

create index task_dependencies_successor_idx on task_dependencies (successor_task_id);

create function check_no_dependency_cycle()
returns trigger
language plpgsql
as $$
begin
  if exists (
    with recursive reachable_from_successor as (
      select successor_task_id as task_id
      from task_dependencies
      where predecessor_task_id = new.successor_task_id
      union
      select td.successor_task_id
      from task_dependencies td
      join reachable_from_successor r on td.predecessor_task_id = r.task_id
    )
    select 1 from reachable_from_successor where task_id = new.predecessor_task_id
  ) then
    raise exception 'this dependency would create a cycle';
  end if;
  return new;
end;
$$;

create trigger task_dependencies_check_cycle
  before insert or update on task_dependencies
  for each row execute function check_no_dependency_cycle();

-- ---------------------------------------------------------------------------
-- Team <-> Project (many-to-many, per the Milestone 1.1 design note)
-- ---------------------------------------------------------------------------
create table team_projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  valid_from date not null default current_date,
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_projects_valid_range check (valid_to is null or valid_to >= valid_from)
);

create unique index team_projects_active_unique
  on team_projects (team_id, project_id)
  where valid_to is null;

-- ---------------------------------------------------------------------------
-- Task history — append-only audit trail for Milestone 3's activity log.
-- No RLS write policy is granted to any role: rows are only ever inserted
-- by the SECURITY DEFINER trigger below, which runs as the table owner and
-- so bypasses RLS the same way is_admin()/has_role_in_organization() do.
-- ---------------------------------------------------------------------------
create table task_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  changed_by_person_id uuid references people (id) on delete set null,
  field_name text not null,
  old_value text,
  new_value text,
  changed_at timestamptz not null default now()
);

create index task_history_task_id_idx on task_history (task_id);

create function log_task_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
begin
  actor_id := current_person_id();

  if new.status is distinct from old.status then
    insert into task_history (task_id, changed_by_person_id, field_name, old_value, new_value)
    values (new.id, actor_id, 'status', old.status::text, new.status::text);
  end if;

  if new.assignee_person_id is distinct from old.assignee_person_id then
    insert into task_history (task_id, changed_by_person_id, field_name, old_value, new_value)
    values (new.id, actor_id, 'assignee_person_id', old.assignee_person_id::text, new.assignee_person_id::text);
  end if;

  if new.reviewer_person_id is distinct from old.reviewer_person_id then
    insert into task_history (task_id, changed_by_person_id, field_name, old_value, new_value)
    values (new.id, actor_id, 'reviewer_person_id', old.reviewer_person_id::text, new.reviewer_person_id::text);
  end if;

  if new.deadline is distinct from old.deadline then
    insert into task_history (task_id, changed_by_person_id, field_name, old_value, new_value)
    values (new.id, actor_id, 'deadline', old.deadline::text, new.deadline::text);
  end if;

  return new;
end;
$$;

create trigger tasks_log_changes
  after update on tasks
  for each row execute function log_task_changes();

-- ---------------------------------------------------------------------------
-- updated_at triggers (reusing set_updated_at() from 0002)
-- ---------------------------------------------------------------------------
create trigger set_updated_at before update on projects
  for each row execute function set_updated_at();
create trigger set_updated_at before update on workstreams
  for each row execute function set_updated_at();
create trigger set_updated_at before update on milestones
  for each row execute function set_updated_at();
create trigger set_updated_at before update on tasks
  for each row execute function set_updated_at();
create trigger set_updated_at before update on team_projects
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helper functions
-- ---------------------------------------------------------------------------
create function project_organization_id(check_project_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from projects where id = check_project_id;
$$;

create function task_organization_id(check_task_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select project_organization_id(project_id) from tasks where id = check_task_id;
$$;

-- Broad visibility: can this person see the project container (and by
-- extension its workstreams/milestones)? True for admin/executive/org-HEAD,
-- or if the person is involved in ANY task within the project. This is
-- deliberately wider than can_view_task() below — a member should see the
-- project their task belongs to, without seeing every sibling task in it.
create function can_view_project(check_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    is_admin()
    or is_executive()
    or has_role_in_organization('HEAD', project_organization_id(check_project_id))
    or exists (
      select 1 from tasks t
      where t.project_id = check_project_id
        and (
          t.assignee_person_id = current_person_id()
          or t.reviewer_person_id = current_person_id()
          or t.approver_person_id = current_person_id()
          or exists (
            select 1 from task_collaborators tc
            where tc.task_id = t.id and tc.person_id = current_person_id()
          )
        )
    );
$$;

-- Narrow visibility: can this person see this specific task? True for
-- admin/executive/org-HEAD, or direct involvement on this task only.
create function can_view_task(check_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    is_admin()
    or is_executive()
    or exists (
      select 1 from tasks t
      where t.id = check_task_id
        and (
          has_role_in_organization('HEAD', task_organization_id(t.id))
          or t.assignee_person_id = current_person_id()
          or t.reviewer_person_id = current_person_id()
          or t.approver_person_id = current_person_id()
          or exists (
            select 1 from task_collaborators tc
            where tc.task_id = t.id and tc.person_id = current_person_id()
          )
        )
    );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table projects enable row level security;
alter table workstreams enable row level security;
alter table milestones enable row level security;
alter table tasks enable row level security;
alter table task_collaborators enable row level security;
alter table task_dependencies enable row level security;
alter table team_projects enable row level security;
alter table task_history enable row level security;

create policy "scoped read" on projects for select using (can_view_project(id));
create policy "head write" on projects for all
  using (is_admin() or has_role_in_organization('HEAD', organization_id))
  with check (is_admin() or has_role_in_organization('HEAD', organization_id));

create policy "scoped read" on workstreams for select using (can_view_project(project_id));
create policy "head write" on workstreams for all
  using (is_admin() or has_role_in_organization('HEAD', project_organization_id(project_id)))
  with check (is_admin() or has_role_in_organization('HEAD', project_organization_id(project_id)));

create policy "scoped read" on milestones for select using (can_view_project(project_id));
create policy "head write" on milestones for all
  using (is_admin() or has_role_in_organization('HEAD', project_organization_id(project_id)))
  with check (is_admin() or has_role_in_organization('HEAD', project_organization_id(project_id)));

-- No MEMBER write policy yet: safe self-service status transitions
-- (submit/acknowledge/etc.) are a Milestone 3 concern, implemented as
-- narrow RPC functions rather than a broad UPDATE policy that would let a
-- member edit any column on their own task (deadline, assignee, ...).
create policy "scoped read" on tasks for select using (can_view_task(id));
create policy "head write" on tasks for all
  using (is_admin() or has_role_in_organization('HEAD', project_organization_id(project_id)))
  with check (is_admin() or has_role_in_organization('HEAD', project_organization_id(project_id)));

create policy "scoped read" on task_collaborators for select using (can_view_task(task_id));
create policy "head write" on task_collaborators for all
  using (is_admin() or has_role_in_organization('HEAD', task_organization_id(task_id)))
  with check (is_admin() or has_role_in_organization('HEAD', task_organization_id(task_id)));

create policy "scoped read" on task_dependencies for select
  using (can_view_task(predecessor_task_id) or can_view_task(successor_task_id));
-- Requires HEAD authority over BOTH ends (or ADMIN): a dependency can in
-- principle link tasks from two different projects/orgs, and linking them
-- shouldn't require permission on only one side.
create policy "head write" on task_dependencies for all
  using (
    is_admin() or (
      has_role_in_organization('HEAD', task_organization_id(predecessor_task_id))
      and has_role_in_organization('HEAD', task_organization_id(successor_task_id))
    )
  )
  with check (
    is_admin() or (
      has_role_in_organization('HEAD', task_organization_id(predecessor_task_id))
      and has_role_in_organization('HEAD', task_organization_id(successor_task_id))
    )
  );

create policy "authenticated read" on team_projects for select using (auth.uid() is not null);
create policy "head write" on team_projects for all
  using (is_admin() or has_role_in_organization('HEAD', project_organization_id(project_id)))
  with check (is_admin() or has_role_in_organization('HEAD', project_organization_id(project_id)));

-- task_history: read-only for anyone who can view the task; no one gets an
-- INSERT/UPDATE/DELETE policy, so direct client writes are refused and only
-- the SECURITY DEFINER log_task_changes() trigger can populate it.
create policy "scoped read" on task_history for select using (can_view_task(task_id));

-- ---------------------------------------------------------------------------
-- Rollback (manual, additive-only so this is a straightforward teardown):
--
-- drop policy if exists "scoped read" on task_history;
-- drop table if exists task_history;
-- drop function if exists log_task_changes();
-- drop policy if exists "head write" on team_projects;
-- drop policy if exists "authenticated read" on team_projects;
-- drop table if exists team_projects;
-- drop policy if exists "head write" on task_dependencies;
-- drop policy if exists "scoped read" on task_dependencies;
-- drop table if exists task_dependencies;
-- drop function if exists check_no_dependency_cycle();
-- drop policy if exists "head write" on task_collaborators;
-- drop policy if exists "scoped read" on task_collaborators;
-- drop table if exists task_collaborators;
-- drop policy if exists "head write" on tasks;
-- drop policy if exists "scoped read" on tasks;
-- drop table if exists tasks;
-- drop function if exists compute_task_current_holder();
-- drop function if exists check_task_consistency();
-- drop function if exists is_task_overdue(uuid);
-- drop policy if exists "head write" on milestones;
-- drop policy if exists "scoped read" on milestones;
-- drop table if exists milestones;
-- drop function if exists check_milestone_workstream_same_project();
-- drop policy if exists "head write" on workstreams;
-- drop policy if exists "scoped read" on workstreams;
-- drop table if exists workstreams;
-- drop policy if exists "head write" on projects;
-- drop policy if exists "scoped read" on projects;
-- drop table if exists projects;
-- drop function if exists can_view_task(uuid);
-- drop function if exists can_view_project(uuid);
-- drop function if exists task_organization_id(uuid);
-- drop function if exists project_organization_id(uuid);
-- drop type if exists priority_level;
-- drop type if exists task_status;
-- drop type if exists work_origin;
-- drop type if exists milestone_status;
-- drop type if exists project_health;
-- drop type if exists project_status;
