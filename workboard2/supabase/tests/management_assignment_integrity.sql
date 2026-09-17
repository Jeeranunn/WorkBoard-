-- WorkBoard 2.0 — management assignment integrity.
-- Run after migrations 0001-0021 + seed.

-- Put MEMBER-A's t4 into a working state and start a timer.
set app.current_uid = '10000000-0000-0000-0000-000000000005';
select acknowledge_task('70000000-0000-0000-0000-000000000004');
select start_task('70000000-0000-0000-0000-000000000004');
select clock_in();
select start_task_timer('70000000-0000-0000-0000-000000000004');

-- HEAD-A reassigns the task inside Org A. Reassignment must atomically close
-- MEMBER-A's timer so time cannot continue against work they no longer own.
set app.current_uid = '10000000-0000-0000-0000-000000000003';
select manage_task_people(
  '70000000-0000-0000-0000-000000000004',
  '20000000-0000-0000-0000-000000000003',
  null,
  null
);

do $$
declare
  n int;
begin
  select count(*) into n
  from task_time_entries
  where task_id = '70000000-0000-0000-0000-000000000004'
    and ended_at is null;

  if n <> 0 then
    raise exception 'ASSERTION_FAILURE: reassignment must close the old active timer';
  end if;

  raise notice 'OK: reassignment closes active task timer';
end;
$$;

-- HEAD-A cannot assign Org A work to MEMBER-B from Org B.
do $$
begin
  perform manage_task_people(
    '70000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000006',
    null,
    null
  );
  raise exception 'ASSERTION_FAILURE: HEAD-A must not assign Org A work to MEMBER-B';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: cross-organization assignment blocked (%)', sqlerrm;
end;
$$;

-- HEAD-B cannot manage an Org A task at all.
set app.current_uid = '10000000-0000-0000-0000-000000000004';
do $$
begin
  perform manage_task_people(
    '70000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000005',
    null,
    null
  );
  raise exception 'ASSERTION_FAILURE: HEAD-B must not manage Org A task';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: HEAD-B blocked from Org A task management (%)', sqlerrm;
end;
$$;

-- Cleanup MEMBER-A attendance.
set app.current_uid = '10000000-0000-0000-0000-000000000005';
select clock_out();

reset app.current_uid;
select 'ALL MANAGEMENT ASSIGNMENT CHECKS PASSED' as result;
