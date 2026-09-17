-- WorkBoard 2.0 — live capacity time snapshot checks.
-- Run after migrations 0001-0025 + seed.

set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A

select acknowledge_task('70000000-0000-0000-0000-000000000004');
select start_task('70000000-0000-0000-0000-000000000004');
select clock_in();
select start_task_timer('70000000-0000-0000-0000-000000000004');
select pause_task_timer();

do $$
declare
  entry_id uuid;
begin
  select id into entry_id
  from task_time_entries
  where person_id = '20000000-0000-0000-0000-000000000005'
    and task_id = '70000000-0000-0000-0000-000000000004'
    and ended_at is not null
  order by started_at desc
  limit 1;

  perform correct_task_time_entry(
    entry_id,
    now() - interval '10 minutes',
    now(),
    'กำหนดช่วงเวลาเพื่อทดสอบ cumulative timer'
  );
end;
$$;

select start_task_timer('70000000-0000-0000-0000-000000000004');

-- Executive must see the current task, the Clock In time, and the accumulated
-- closed segment. The live segment is intentionally returned separately so
-- the UI can tick locally every second without polling the database.
set app.current_uid = '10000000-0000-0000-0000-000000000002'; -- EXECUTIVE

do $$
declare
  snap record;
begin
  select * into snap
  from capacity_time_snapshot()
  where person_id = '20000000-0000-0000-0000-000000000005';

  if snap.clock_in_at is null then
    raise exception 'ASSERTION_FAILURE: executive cannot see active attendance';
  end if;

  if snap.active_task_id is distinct from '70000000-0000-0000-0000-000000000004'::uuid then
    raise exception 'ASSERTION_FAILURE: executive cannot see active task timer';
  end if;

  if snap.active_task_started_at is null then
    raise exception 'ASSERTION_FAILURE: active task start time missing';
  end if;

  if snap.active_task_accumulated_seconds < 599 then
    raise exception
      'ASSERTION_FAILURE: resumed timer did not preserve prior accumulated time (%)',
      snap.active_task_accumulated_seconds;
  end if;

  raise notice 'OK: executive sees live attendance and cumulative resumed task timer';
end;
$$;

-- Starting a break must close the active task timer; snapshot then reports
-- break state and no running task, while historical task time remains stored.
set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A
select start_break();

set app.current_uid = '10000000-0000-0000-0000-000000000002'; -- EXECUTIVE

do $$
declare
  snap record;
begin
  select * into snap
  from capacity_time_snapshot()
  where person_id = '20000000-0000-0000-0000-000000000005';

  if not snap.is_on_break or snap.break_started_at is null then
    raise exception 'ASSERTION_FAILURE: active break missing from capacity snapshot';
  end if;

  if snap.active_task_id is not null then
    raise exception 'ASSERTION_FAILURE: task timer remained active during break';
  end if;

  raise notice 'OK: break is visible and task timer stops while break is active';
end;
$$;

set app.current_uid = '10000000-0000-0000-0000-000000000005';
select resume_from_break();
select clock_out();

reset app.current_uid;
select 'ALL CAPACITY TIME SNAPSHOT CHECKS PASSED' as result;
