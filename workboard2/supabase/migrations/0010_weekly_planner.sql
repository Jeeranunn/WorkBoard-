-- WorkBoard 2.0 — Weekly Planner integration
--
-- Brings the (separate) weekly-work-planner app onto this Supabase project
-- as a planning layer over WorkBoard's own data. WorkBoard stays canonical
-- for auth/people/organizations/teams/projects/tasks/permissions; nothing
-- here duplicates those. Additive only — 0001-0009 untouched.
--
-- Merge decisions this migration encodes (see conversation history for the
-- full conflict analysis):
--   - Planner's `profiles` table is retired — `people` + `person_roles`
--     already cover it (name, role, team membership).
--   - Planner's `is_chair()` maps to ADMIN or EXECUTIVE (global oversight,
--     no org scoping) — never HEAD, which stays org-scoped per the
--     existing permission model.
--   - Planner's own `tasks` table is retired — formal work is always a
--     WorkBoard task. Planner's "quadrant" (q1-4) was already the same
--     2x2 matrix as WorkBoard's is_important/is_urgent -> priority, so
--     it's not re-stored here.
--   - Genuinely personal/ad-hoc items (not formal WorkBoard work) get
--     their own table, personal_planner_items, kept private by default —
--     this is NOT a second "tasks" table.
--   - planned_slots schedules exactly one of a WorkBoard task or a
--     personal item (never both, never neither).
--   - Suggestions stay proposals: accepting one only flips its own status
--     — it never writes to tasks.is_important/is_urgent. Applying an
--     accepted suggestion's values is a deliberately separate concern,
--     not built here.

-- ---------------------------------------------------------------------------
-- Chair = global oversight (ADMIN or EXECUTIVE). Never org-scoped — that's
-- what HEAD already is, and this is intentionally not that.
-- ---------------------------------------------------------------------------
create function is_chair()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_admin() or is_executive();
$$;

-- ---------------------------------------------------------------------------
-- Personal planner items — private ad-hoc/personal to-dos, distinct from
-- formal WorkBoard tasks. Not visible to EXECUTIVE/chair by default; ADMIN
-- keeps access for data support, matching every other table's convention.
-- ---------------------------------------------------------------------------
create table personal_planner_items (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people (id) on delete cascade,
  title text not null,
  notes text,
  is_important boolean not null default true,
  is_urgent boolean not null default false,
  deadline timestamptz,
  estimated_hours numeric(6, 2),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index personal_planner_items_person_id_idx on personal_planner_items (person_id);

create trigger set_updated_at before update on personal_planner_items
  for each row execute function set_updated_at();

alter table personal_planner_items enable row level security;

create policy "owner or admin read" on personal_planner_items for select
  using (person_id = current_person_id() or is_admin());
create policy "owner or admin write" on personal_planner_items for all
  using (person_id = current_person_id() or is_admin())
  with check (person_id = current_person_id() or is_admin());

-- ---------------------------------------------------------------------------
-- Availability — a planning input, not personal/sensitive the way ad-hoc
-- items are: EXECUTIVE (chair) oversight of team capacity is the whole
-- point per the original Planner spec, so it's visible to chair, unlike
-- personal_planner_items.
-- ---------------------------------------------------------------------------
create table availability (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people (id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  status text not null check (status in ('free', 'busy', 'maybe')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_range check (end_time >= start_time)
);

create index availability_person_id_date_idx on availability (person_id, date);

create trigger set_updated_at before update on availability
  for each row execute function set_updated_at();

alter table availability enable row level security;

create policy "self or oversight read" on availability for select
  using (person_id = current_person_id() or is_admin() or is_executive());
create policy "owner write" on availability for all
  using (person_id = current_person_id() or is_admin())
  with check (person_id = current_person_id() or is_admin());

-- ---------------------------------------------------------------------------
-- Planned slots — schedules exactly one of a WorkBoard task or a personal
-- item into a date/time block. Never both, never neither.
-- ---------------------------------------------------------------------------
create table planned_slots (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people (id) on delete cascade,
  workboard_task_id uuid references tasks (id) on delete cascade,
  personal_planner_item_id uuid references personal_planner_items (id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planned_slots_range check (end_time >= start_time),
  constraint planned_slots_exactly_one_source check (
    (workboard_task_id is not null)::int + (personal_planner_item_id is not null)::int = 1
  )
);

create index planned_slots_person_id_date_idx on planned_slots (person_id, date);
create index planned_slots_workboard_task_id_idx on planned_slots (workboard_task_id);
create index planned_slots_personal_planner_item_id_idx on planned_slots (personal_planner_item_id);

create trigger set_updated_at before update on planned_slots
  for each row execute function set_updated_at();

alter table planned_slots enable row level security;

-- Chair (EXECUTIVE/ADMIN) sees slots that schedule formal WorkBoard work
-- (team capacity oversight) but never ones scheduling someone's personal
-- item — those stay as private as the item itself.
create policy "self or formal-work oversight read" on planned_slots for select
  using (
    person_id = current_person_id()
    or is_admin()
    or (is_executive() and workboard_task_id is not null)
  );

-- A person can only ever schedule their own task assignments or their own
-- personal items — never someone else's, even though the FK alone would
-- allow pointing at any row.
create policy "owner write" on planned_slots for all
  using (person_id = current_person_id() or is_admin())
  with check (
    (person_id = current_person_id() or is_admin())
    and (
      workboard_task_id is null
      or exists (
        select 1 from tasks t
        where t.id = workboard_task_id and t.assignee_person_id = person_id
      )
    )
    and (
      personal_planner_item_id is null
      or exists (
        select 1 from personal_planner_items pi
        where pi.id = personal_planner_item_id and pi.person_id = person_id
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Suggestions — chair proposes new importance/urgency for a WorkBoard task;
-- the task's assignee accepts or rejects. Proposals only: responding never
-- writes to tasks.is_important/is_urgent (see respond_to_suggestion below).
-- ---------------------------------------------------------------------------
create table suggestions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  suggested_by uuid not null references people (id) on delete restrict,
  suggested_is_important boolean not null,
  suggested_is_urgent boolean not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index suggestions_task_id_idx on suggestions (task_id);
create index suggestions_status_idx on suggestions (status);

alter table suggestions enable row level security;

create policy "chair insert" on suggestions for insert
  with check (is_chair() and suggested_by = current_person_id());

create policy "chair or task owner read" on suggestions for select
  using (
    is_chair()
    or exists (
      select 1 from tasks t
      where t.id = suggestions.task_id and t.assignee_person_id = current_person_id()
    )
  );

-- No update/delete policy for anyone: status only ever changes via
-- respond_to_suggestion() below, and rows are kept as an audit trail.

-- Task owner responds; status must still be pending (immutable once
-- answered — a changed mind means a new suggestion, matching the original
-- Planner design). Does not touch the underlying task.
create function respond_to_suggestion(p_suggestion_id uuid, p_status text)
returns suggestions
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  suggestion_row suggestions;
  owner_id uuid;
begin
  if p_status not in ('accepted', 'rejected') then
    raise exception 'สถานะไม่ถูกต้อง';
  end if;

  select * into suggestion_row from suggestions where id = p_suggestion_id for update;
  if not found then
    raise exception 'ไม่พบคำแนะนำนี้';
  end if;

  select assignee_person_id into owner_id from tasks where id = suggestion_row.task_id;
  if owner_id is distinct from actor_id then
    raise exception 'ไม่มีสิทธิ์ตอบกลับคำแนะนำนี้';
  end if;
  if suggestion_row.status <> 'pending' then
    raise exception 'คำแนะนำนี้ถูกตอบกลับไปแล้ว';
  end if;

  update suggestions set status = p_status, responded_at = now() where id = p_suggestion_id;
  return (select s from suggestions s where s.id = p_suggestion_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Rollback (manual, additive-only):
--
-- drop function if exists respond_to_suggestion(uuid, text);
-- drop table if exists suggestions;
-- drop table if exists planned_slots;
-- drop table if exists availability;
-- drop table if exists personal_planner_items;
-- drop function if exists is_chair();
