-- WorkBoard 2.0 — time tracking integrity hardening.
--
-- Fixes conflicts found in the completion audit:
-- 1) HEAD/ADMIN workflow override previously also let them record their own
--    task time against somebody else's task. Time tracking must represent the
--    actual assignee doing the work, so timer RPCs are assignee-only.
-- 2) Starting a break previously left an active task timer running, causing
--    break minutes to be counted as task work. Starting a break now closes the
--    active task timer atomically.
-- 3) Timers could be started on tasks not in an active working state. Restrict
--    new/switch timers to IN_PROGRESS or REVISION_REQUIRED.

create or replace function start_break()
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
  select id into session_id
  from attendance_sessions
  where person_id = actor_id and clock_out_at is null
  for update;

  if session_id is null then
    raise exception 'ต้อง Clock In ก่อนพัก';
  end if;

  if exists (
    select 1
    from attendance_breaks
    where attendance_session_id = session_id
      and break_end_at is null
  ) then
    raise exception 'คุณกำลังพักอยู่แล้ว';
  end if;

  -- Break time must never be counted as task time.
  update task_time_entries
  set ended_at = now()
  where person_id = actor_id
    and ended_at is null;

  insert into attendance_breaks (attendance_session_id, break_start_at)
  values (session_id, now())
  returning * into result;

  return result;
end;
$$;

create or replace function start_task_timer(p_task_id uuid)
returns task_time_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  task_row tasks;
  result task_time_entries;
begin
  select * into task_row
  from tasks
  where id = p_task_id;

  if not found then
    raise exception 'ไม่พบงานนี้';
  end if;

  if task_row.assignee_person_id is distinct from actor_id then
    raise exception 'จับเวลาได้เฉพาะงานที่มอบหมายให้คุณ';
  end if;

  if task_row.status not in ('IN_PROGRESS', 'REVISION_REQUIRED') then
    raise exception 'เริ่มจับเวลาได้เมื่องานกำลังดำเนินการหรืออยู่ระหว่างแก้ไข';
  end if;

  if not exists (
    select 1 from attendance_sessions
    where person_id = actor_id and clock_out_at is null
  ) then
    raise exception 'ต้อง Clock In ก่อนเริ่มจับเวลางาน';
  end if;

  if exists (
    select 1
    from attendance_breaks ab
    join attendance_sessions s on s.id = ab.attendance_session_id
    where s.person_id = actor_id
      and s.clock_out_at is null
      and ab.break_end_at is null
  ) then
    raise exception 'กำลังพักอยู่ ไม่สามารถเริ่มจับเวลางานได้';
  end if;

  if exists (
    select 1 from task_time_entries
    where person_id = actor_id and ended_at is null
  ) then
    raise exception 'มีงานที่กำลังจับเวลาอยู่ ให้หยุดหรือสลับงานแทน';
  end if;

  insert into task_time_entries (task_id, person_id, started_at, source)
  values (p_task_id, actor_id, now(), 'SYSTEM_TRACKED')
  returning * into result;

  return result;
end;
$$;

create or replace function switch_task_timer(p_task_id uuid)
returns task_time_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  task_row tasks;
  result task_time_entries;
begin
  select * into task_row
  from tasks
  where id = p_task_id;

  if not found then
    raise exception 'ไม่พบงานนี้';
  end if;

  if task_row.assignee_person_id is distinct from actor_id then
    raise exception 'จับเวลาได้เฉพาะงานที่มอบหมายให้คุณ';
  end if;

  if task_row.status not in ('IN_PROGRESS', 'REVISION_REQUIRED') then
    raise exception 'เริ่มจับเวลาได้เมื่องานกำลังดำเนินการหรืออยู่ระหว่างแก้ไข';
  end if;

  if not exists (
    select 1 from attendance_sessions
    where person_id = actor_id and clock_out_at is null
  ) then
    raise exception 'ต้อง Clock In ก่อนเริ่มจับเวลางาน';
  end if;

  if exists (
    select 1
    from attendance_breaks ab
    join attendance_sessions s on s.id = ab.attendance_session_id
    where s.person_id = actor_id
      and s.clock_out_at is null
      and ab.break_end_at is null
  ) then
    raise exception 'กำลังพักอยู่ ไม่สามารถเริ่มจับเวลางานได้';
  end if;

  update task_time_entries
  set ended_at = now()
  where person_id = actor_id
    and ended_at is null;

  insert into task_time_entries (task_id, person_id, started_at, source)
  values (p_task_id, actor_id, now(), 'SYSTEM_TRACKED')
  returning * into result;

  return result;
end;
$$;
