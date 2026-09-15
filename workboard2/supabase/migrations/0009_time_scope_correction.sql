-- WorkBoard 2.0 — Milestone 5.1: Time Permission Scope Correction
--
-- Bug: 0008's RLS and correction RPCs used has_role('HEAD') — true for ANY
-- head of ANY organization — so a HEAD of Organization A could read/correct
-- time data for a person only ever appointed in Organization B.
--
-- Fix: HEAD oversight is scoped to the organizations a person is actively
-- appointed into (via appointments -> positions -> organization_units),
-- computed server-side. Does not modify 0008 — only replaces its policies
-- (drop + recreate) and functions (CREATE OR REPLACE).

-- ---------------------------------------------------------------------------
-- A person's active organizations, derived from their current
-- appointments — supports someone holding positions in several
-- organizations at once, and changes automatically as appointments end.
-- ---------------------------------------------------------------------------
create function person_organization_ids(check_person_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct ou.organization_id
  from appointments a
  join positions p on p.id = a.position_id
  join organization_units ou on ou.id = p.unit_id
  where a.person_id = check_person_id
    and a.valid_from <= current_date
    and (a.valid_to is null or a.valid_to >= current_date)
    and p.valid_from <= current_date
    and (p.valid_to is null or p.valid_to >= current_date)
    and ou.valid_from <= current_date
    and (ou.valid_to is null or ou.valid_to >= current_date);
$$;

-- Can the current user oversee this person as HEAD? True only if the
-- current person holds HEAD in an organization the target person is
-- actively appointed into right now — never a global "is HEAD of
-- anywhere" check.
create function is_head_over_person(check_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from person_organization_ids(check_person_id) org_id
    where has_role_in_organization('HEAD', org_id)
  );
$$;

-- Resolves which person a time_corrections row is about, so its own read
-- policy can scope by that person rather than by the corrector.
create function time_correction_target_person(p_target_table text, p_target_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result uuid;
begin
  if p_target_table = 'attendance_sessions' then
    select person_id into result from attendance_sessions where id = p_target_id;
  elsif p_target_table = 'task_time_entries' then
    select person_id into result from task_time_entries where id = p_target_id;
  end if;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: replace the global has_role('HEAD') checks with org-scoped oversight.
-- ---------------------------------------------------------------------------
drop policy "self or oversight read" on attendance_sessions;
create policy "self or oversight read" on attendance_sessions for select
  using (
    person_id = current_person_id()
    or is_admin()
    or is_executive()
    or is_head_over_person(person_id)
  );

drop policy "self or oversight read" on attendance_breaks;
create policy "self or oversight read" on attendance_breaks for select
  using (
    exists (
      select 1 from attendance_sessions s
      where s.id = attendance_breaks.attendance_session_id
        and (
          s.person_id = current_person_id()
          or is_admin()
          or is_executive()
          or is_head_over_person(s.person_id)
        )
    )
  );

drop policy "self or oversight read" on task_time_entries;
create policy "self or oversight read" on task_time_entries for select
  using (
    person_id = current_person_id()
    or is_admin()
    or is_executive()
    or is_head_over_person(person_id)
  );

drop policy "self or oversight read" on time_corrections;
create policy "self or oversight read" on time_corrections for select
  using (
    corrected_by_person_id = current_person_id()
    or is_admin()
    or is_head_over_person(time_correction_target_person(target_table, target_id))
  );

-- ---------------------------------------------------------------------------
-- Corrections: same signatures as 0008, replaced in place. EXECUTIVE is
-- deliberately never in the allow-list — that role has no correction
-- authority. Source is decided by "is this the person's own record?", not
-- by which permission path let the write through, so a HEAD correcting
-- their own entry still logs as SELF_DECLARED rather than RECONSTRUCTED.
-- ---------------------------------------------------------------------------
create or replace function correct_attendance_session(
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
  is_self boolean;
  new_source time_entry_source;
begin
  select * into session_row from attendance_sessions where id = p_session_id for update;
  if not found then
    raise exception 'ไม่พบข้อมูลนี้';
  end if;

  is_self := actor_id = session_row.person_id;

  if not (is_self or is_admin() or is_head_over_person(session_row.person_id)) then
    raise exception 'ไม่มีสิทธิ์แก้ไขเวลานี้';
  end if;

  new_source := case when is_self then 'SELF_DECLARED'::time_entry_source
    else 'RECONSTRUCTED'::time_entry_source end;

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

create or replace function correct_task_time_entry(
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
  is_self boolean;
  new_source time_entry_source;
begin
  select * into entry_row from task_time_entries where id = p_entry_id for update;
  if not found then
    raise exception 'ไม่พบข้อมูลนี้';
  end if;

  is_self := actor_id = entry_row.person_id;

  if not (is_self or is_admin() or is_head_over_person(entry_row.person_id)) then
    raise exception 'ไม่มีสิทธิ์แก้ไขเวลานี้';
  end if;

  new_source := case when is_self then 'SELF_DECLARED'::time_entry_source
    else 'RECONSTRUCTED'::time_entry_source end;

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
-- Rollback (manual): restores the 0008 (global has_role('HEAD')) behavior —
-- not recommended, reintroduces the cross-org leak this migration fixes.
--
-- create or replace function correct_task_time_entry(uuid, timestamptz, timestamptz, text) ... (0008 version)
-- create or replace function correct_attendance_session(uuid, timestamptz, timestamptz, text) ... (0008 version)
-- drop policy "self or oversight read" on time_corrections;
-- create policy "self or oversight read" on time_corrections for select
--   using (corrected_by_person_id = current_person_id() or is_admin() or has_role('HEAD'));
-- drop policy "self or oversight read" on task_time_entries;
-- create policy "self or oversight read" on task_time_entries for select
--   using (person_id = current_person_id() or is_admin() or is_executive() or has_role('HEAD'));
-- drop policy "self or oversight read" on attendance_breaks;
-- create policy "self or oversight read" on attendance_breaks for select
--   using (exists (select 1 from attendance_sessions s where s.id = attendance_breaks.attendance_session_id
--     and (s.person_id = current_person_id() or is_admin() or is_executive() or has_role('HEAD'))));
-- drop policy "self or oversight read" on attendance_sessions;
-- create policy "self or oversight read" on attendance_sessions for select
--   using (person_id = current_person_id() or is_admin() or is_executive() or has_role('HEAD'));
-- drop function if exists time_correction_target_person(text, uuid);
-- drop function if exists is_head_over_person(uuid);
-- drop function if exists person_organization_ids(uuid);
