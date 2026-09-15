-- WorkBoard 2.0 — Milestone 5: Time Tracking
-- Attendance (Clock In/Break/Resume/Clock Out) kept separate from Task
-- Time (Start/Pause/Switch), both carrying a source/confidence tag, plus
-- an append-only correction audit trail. Additive only — 0001-0007
-- untouched.
--
-- Every mutation goes through the RPCs below (SECURITY DEFINER); no role
-- gets a direct INSERT/UPDATE policy on these tables, so "only one active
-- timer" and "corrections are logged" can't be bypassed from the client.

create type time_entry_source as enum ('SYSTEM_TRACKED', 'RECONSTRUCTED', 'SELF_DECLARED');

-- ---------------------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------------------
create table attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people (id) on delete cascade,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  source time_entry_source not null default 'SYSTEM_TRACKED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_sessions_range check (clock_out_at is null or clock_out_at >= clock_in_at)
);

-- One open attendance session per person at a time.
create unique index attendance_sessions_active_unique
  on attendance_sessions (person_id) where clock_out_at is null;

create index attendance_sessions_person_id_idx on attendance_sessions (person_id);

create table attendance_breaks (
  id uuid primary key default gen_random_uuid(),
  attendance_session_id uuid not null references attendance_sessions (id) on delete cascade,
  break_start_at timestamptz not null,
  break_end_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_breaks_range check (break_end_at is null or break_end_at >= break_start_at)
);

-- One open break per session at a time.
create unique index attendance_breaks_active_unique
  on attendance_breaks (attendance_session_id) where break_end_at is null;

-- ---------------------------------------------------------------------------
-- Task time (separate from attendance — a person can be clocked in without
-- an active task timer, but not the reverse; enforced in the RPCs below).
-- ---------------------------------------------------------------------------
create table task_time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  person_id uuid not null references people (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  source time_entry_source not null default 'SYSTEM_TRACKED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_time_entries_range check (ended_at is null or ended_at >= started_at)
);

-- The core rule: never more than one active task timer per person.
create unique index task_time_entries_active_unique
  on task_time_entries (person_id) where ended_at is null;

create index task_time_entries_task_id_idx on task_time_entries (task_id);
create index task_time_entries_person_id_idx on task_time_entries (person_id);

-- ---------------------------------------------------------------------------
-- Correction audit trail. A correction always changes the row's `source`
-- away from SYSTEM_TRACKED (see the RPCs below), so a corrected entry can
-- never be displayed as if it were an untouched, system-verified record.
-- ---------------------------------------------------------------------------
create table time_corrections (
  id uuid primary key default gen_random_uuid(),
  target_table text not null check (target_table in ('attendance_sessions', 'task_time_entries')),
  target_id uuid not null,
  field_name text not null,
  old_value text,
  new_value text,
  reason text,
  corrected_by_person_id uuid not null references people (id) on delete restrict,
  corrected_at timestamptz not null default now()
);

create index time_corrections_target_idx on time_corrections (target_table, target_id);

create trigger set_updated_at before update on attendance_sessions
  for each row execute function set_updated_at();
create trigger set_updated_at before update on attendance_breaks
  for each row execute function set_updated_at();
create trigger set_updated_at before update on task_time_entries
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — read: self, ADMIN, EXECUTIVE, or any HEAD (basic team/executive
-- workload visibility; not org-scoped since a person's org membership can
-- span multiple appointments — a acceptable trade-off for v0 given this
-- is read-only). Write: no policies at all — RPC-only.
-- ---------------------------------------------------------------------------
alter table attendance_sessions enable row level security;
alter table attendance_breaks enable row level security;
alter table task_time_entries enable row level security;
alter table time_corrections enable row level security;

create policy "self or oversight read" on attendance_sessions for select
  using (
    person_id = current_person_id() or is_admin() or is_executive() or has_role('HEAD')
  );

create policy "self or oversight read" on attendance_breaks for select
  using (
    exists (
      select 1 from attendance_sessions s
      where s.id = attendance_breaks.attendance_session_id
        and (s.person_id = current_person_id() or is_admin() or is_executive() or has_role('HEAD'))
    )
  );

create policy "self or oversight read" on task_time_entries for select
  using (
    person_id = current_person_id() or is_admin() or is_executive() or has_role('HEAD')
  );

create policy "self or oversight read" on time_corrections for select
  using (
    corrected_by_person_id = current_person_id() or is_admin() or has_role('HEAD')
  );

-- ---------------------------------------------------------------------------
-- Attendance RPCs
-- ---------------------------------------------------------------------------
create function clock_in()
returns attendance_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  result attendance_sessions;
begin
  if exists (select 1 from attendance_sessions where person_id = actor_id and clock_out_at is null) then
    raise exception 'คุณ Clock In ไว้อยู่แล้ว';
  end if;

  insert into attendance_sessions (person_id, clock_in_at, source)
  values (actor_id, now(), 'SYSTEM_TRACKED')
  returning * into result;

  return result;
end;
$$;

create function start_break()
returns attendance_breaks
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  session_id uuid;
  result attendance_breaks;
begin
  select id into session_id from attendance_sessions
    where person_id = actor_id and clock_out_at is null;
  if session_id is null then
    raise exception 'ต้อง Clock In ก่อนพัก';
  end if;
  if exists (select 1 from attendance_breaks where attendance_session_id = session_id and break_end_at is null) then
    raise exception 'คุณกำลังพักอยู่แล้ว';
  end if;

  insert into attendance_breaks (attendance_session_id, break_start_at)
  values (session_id, now())
  returning * into result;

  return result;
end;
$$;

create function resume_from_break()
returns attendance_breaks
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  break_id uuid;
begin
  select ab.id into break_id
    from attendance_breaks ab
    join attendance_sessions s on s.id = ab.attendance_session_id
    where s.person_id = actor_id and s.clock_out_at is null and ab.break_end_at is null
    for update of ab;

  if break_id is null then
    raise exception 'คุณไม่ได้กำลังพักอยู่';
  end if;

  update attendance_breaks set break_end_at = now() where id = break_id;
  return (select ab from attendance_breaks ab where ab.id = break_id);
end;
$$;

create function clock_out()
returns attendance_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  session_id uuid;
begin
  select id into session_id from attendance_sessions
    where person_id = actor_id and clock_out_at is null
    for update;

  if session_id is null then
    raise exception 'คุณยังไม่ได้ Clock In';
  end if;

  update attendance_breaks set break_end_at = now()
    where attendance_session_id = session_id and break_end_at is null;

  update task_time_entries set ended_at = now()
    where person_id = actor_id and ended_at is null;

  update attendance_sessions set clock_out_at = now() where id = session_id;
  return (select s from attendance_sessions s where s.id = session_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Task timer RPCs — reuse is_task_assignee_side_actor() from 0005 so only
-- the assignee (or org-HEAD/ADMIN) can clock time against a task.
-- ---------------------------------------------------------------------------
create function start_task_timer(p_task_id uuid)
returns task_time_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  result task_time_entries;
begin
  if not is_task_assignee_side_actor(p_task_id) then
    raise exception 'ไม่มีสิทธิ์จับเวลางานนี้';
  end if;
  if not exists (select 1 from attendance_sessions where person_id = actor_id and clock_out_at is null) then
    raise exception 'ต้อง Clock In ก่อนเริ่มจับเวลางาน';
  end if;
  if exists (
    select 1 from attendance_breaks ab
    join attendance_sessions s on s.id = ab.attendance_session_id
    where s.person_id = actor_id and s.clock_out_at is null and ab.break_end_at is null
  ) then
    raise exception 'กำลังพักอยู่ ไม่สามารถเริ่มจับเวลางานได้';
  end if;
  if exists (select 1 from task_time_entries where person_id = actor_id and ended_at is null) then
    raise exception 'มีงานที่กำลังจับเวลาอยู่ ให้หยุดหรือสลับงานแทน';
  end if;

  insert into task_time_entries (task_id, person_id, started_at, source)
  values (p_task_id, actor_id, now(), 'SYSTEM_TRACKED')
  returning * into result;

  return result;
end;
$$;

create function pause_task_timer()
returns task_time_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  entry_id uuid;
begin
  select id into entry_id from task_time_entries
    where person_id = actor_id and ended_at is null
    for update;

  if entry_id is null then
    raise exception 'ไม่มีงานที่กำลังจับเวลาอยู่';
  end if;

  update task_time_entries set ended_at = now() where id = entry_id;
  return (select t from task_time_entries t where t.id = entry_id);
end;
$$;

create function switch_task_timer(p_task_id uuid)
returns task_time_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  result task_time_entries;
begin
  if not is_task_assignee_side_actor(p_task_id) then
    raise exception 'ไม่มีสิทธิ์จับเวลางานนี้';
  end if;
  if not exists (select 1 from attendance_sessions where person_id = actor_id and clock_out_at is null) then
    raise exception 'ต้อง Clock In ก่อนเริ่มจับเวลางาน';
  end if;
  if exists (
    select 1 from attendance_breaks ab
    join attendance_sessions s on s.id = ab.attendance_session_id
    where s.person_id = actor_id and s.clock_out_at is null and ab.break_end_at is null
  ) then
    raise exception 'กำลังพักอยู่ ไม่สามารถเริ่มจับเวลางานได้';
  end if;

  update task_time_entries set ended_at = now() where person_id = actor_id and ended_at is null;

  insert into task_time_entries (task_id, person_id, started_at, source)
  values (p_task_id, actor_id, now(), 'SYSTEM_TRACKED')
  returning * into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Corrections — self-declare your own entry, or ADMIN/any HEAD reconstructs
-- someone else's. Every changed field is logged; source always moves away
-- from SYSTEM_TRACKED so the UI never shows a corrected entry as verified.
-- ---------------------------------------------------------------------------
create function correct_attendance_session(
  p_session_id uuid, p_clock_in_at timestamptz, p_clock_out_at timestamptz, p_reason text
)
returns attendance_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  session_row attendance_sessions;
  new_source time_entry_source;
begin
  select * into session_row from attendance_sessions where id = p_session_id for update;
  if not found then
    raise exception 'ไม่พบข้อมูลนี้';
  end if;
  if not (actor_id = session_row.person_id or is_admin() or has_role('HEAD')) then
    raise exception 'ไม่มีสิทธิ์แก้ไขเวลานี้';
  end if;

  new_source := case
    when actor_id = session_row.person_id and not is_admin() and not has_role('HEAD')
    then 'SELF_DECLARED'::time_entry_source
    else 'RECONSTRUCTED'::time_entry_source
  end;

  if session_row.clock_in_at is distinct from p_clock_in_at then
    insert into time_corrections (target_table, target_id, field_name, old_value, new_value, reason, corrected_by_person_id)
    values ('attendance_sessions', p_session_id, 'clock_in_at', session_row.clock_in_at::text, p_clock_in_at::text, p_reason, actor_id);
  end if;
  if session_row.clock_out_at is distinct from p_clock_out_at then
    insert into time_corrections (target_table, target_id, field_name, old_value, new_value, reason, corrected_by_person_id)
    values ('attendance_sessions', p_session_id, 'clock_out_at', session_row.clock_out_at::text, p_clock_out_at::text, p_reason, actor_id);
  end if;

  update attendance_sessions
    set clock_in_at = p_clock_in_at, clock_out_at = p_clock_out_at, source = new_source
    where id = p_session_id;

  return (select s from attendance_sessions s where s.id = p_session_id);
end;
$$;

create function correct_task_time_entry(
  p_entry_id uuid, p_started_at timestamptz, p_ended_at timestamptz, p_reason text
)
returns task_time_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  entry_row task_time_entries;
  new_source time_entry_source;
begin
  select * into entry_row from task_time_entries where id = p_entry_id for update;
  if not found then
    raise exception 'ไม่พบข้อมูลนี้';
  end if;
  if not (actor_id = entry_row.person_id or is_admin() or has_role('HEAD')) then
    raise exception 'ไม่มีสิทธิ์แก้ไขเวลานี้';
  end if;

  new_source := case
    when actor_id = entry_row.person_id and not is_admin() and not has_role('HEAD')
    then 'SELF_DECLARED'::time_entry_source
    else 'RECONSTRUCTED'::time_entry_source
  end;

  if entry_row.started_at is distinct from p_started_at then
    insert into time_corrections (target_table, target_id, field_name, old_value, new_value, reason, corrected_by_person_id)
    values ('task_time_entries', p_entry_id, 'started_at', entry_row.started_at::text, p_started_at::text, p_reason, actor_id);
  end if;
  if entry_row.ended_at is distinct from p_ended_at then
    insert into time_corrections (target_table, target_id, field_name, old_value, new_value, reason, corrected_by_person_id)
    values ('task_time_entries', p_entry_id, 'ended_at', entry_row.ended_at::text, p_ended_at::text, p_reason, actor_id);
  end if;

  update task_time_entries
    set started_at = p_started_at, ended_at = p_ended_at, source = new_source
    where id = p_entry_id;

  return (select t from task_time_entries t where t.id = p_entry_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Rollback (manual, additive-only):
--
-- drop function if exists correct_task_time_entry(uuid, timestamptz, timestamptz, text);
-- drop function if exists correct_attendance_session(uuid, timestamptz, timestamptz, text);
-- drop function if exists switch_task_timer(uuid);
-- drop function if exists pause_task_timer();
-- drop function if exists start_task_timer(uuid);
-- drop function if exists clock_out();
-- drop function if exists resume_from_break();
-- drop function if exists start_break();
-- drop function if exists clock_in();
-- drop table if exists time_corrections;
-- drop table if exists task_time_entries;
-- drop table if exists attendance_breaks;
-- drop table if exists attendance_sessions;
-- drop type if exists time_entry_source;
