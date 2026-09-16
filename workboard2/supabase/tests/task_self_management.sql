-- WorkBoard 2.0 — task self-management acceptance.
-- Run after migrations 0001-0027 + seed.

-- MEMBER-A may change priority on their own assigned task.
set app.current_uid = '10000000-0000-0000-0000-000000000005';

select update_task_priority(
  '70000000-0000-0000-0000-000000000004',
  false,
  true
);

do $$
begin
  if (select priority from tasks where id = '70000000-0000-0000-0000-000000000004') <> 'P3' then
    raise exception 'ASSERTION_FAILURE: member priority update did not produce P3';
  end if;
  raise notice 'OK: member can correct own task priority';
end;
$$;

-- Create a manual task, then correct details and remove it from active work.
select * from create_manual_task(
  '50000000-0000-0000-0000-000000000001',
  'งานพิมพ์ผิด',
  'รายละเอียดเดิม',
  null,
  null,
  null,
  null,
  now() + interval '1 day',
  1,
  true,
  false
);

do $$
declare
  manual_id uuid;
begin
  select id into manual_id
  from tasks
  where project_id = '50000000-0000-0000-0000-000000000001'
    and assignee_person_id = '20000000-0000-0000-0000-000000000005'
    and source = 'MANUAL'
    and title = 'งานพิมพ์ผิด'
  order by created_at desc
  limit 1;

  perform update_manual_task_details(
    manual_id,
    'งานแก้ชื่อแล้ว',
    'รายละเอียดใหม่',
    now() + interval '2 days',
    2.5,
    true,
    true
  );

  if not exists (
    select 1 from tasks
    where id = manual_id
      and title = 'งานแก้ชื่อแล้ว'
      and description = 'รายละเอียดใหม่'
      and estimated_hours = 2.5
      and priority = 'P1'
  ) then
    raise exception 'ASSERTION_FAILURE: manual task edit did not persist';
  end if;

  perform cancel_task_from_active_work(manual_id);

  if (select status from tasks where id = manual_id) <> 'CANCELLED' then
    raise exception 'ASSERTION_FAILURE: safe removal must set CANCELLED';
  end if;

  raise notice 'OK: member can edit and safely remove own manual task';
end;
$$;

-- MEMBER-B cannot edit MEMBER-A priority.
set app.current_uid = '10000000-0000-0000-0000-000000000006';

do $$
begin
  perform update_task_priority(
    '70000000-0000-0000-0000-000000000004',
    true,
    true
  );
  raise exception 'ASSERTION_FAILURE: MEMBER-B changed MEMBER-A priority';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: another member cannot edit priority (%)', sqlerrm;
end;
$$;

-- Cancellation must stop any active timer on the task, preserve history of
-- the transition, and clear current_holder_person_id — none of this is
-- special-cased inside cancel_task_from_active_work() itself; it relies on
-- the same generic tasks-table triggers every other status change uses
-- (stop_task_timer_on_task_transition from 0020, log_task_changes from
-- 0003/0004, compute_task_current_holder from 0006), so this locks that
-- reliance in as a regression check.
set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A

select * from create_manual_task(
  '50000000-0000-0000-0000-000000000001',
  'งานทดสอบยกเลิกระหว่างจับเวลา',
  null, null, null, null, null,
  now() + interval '1 day', 1, true, false
);

do $$
declare
  manual_id uuid;
begin
  select id into manual_id
  from tasks
  where source = 'MANUAL'
    and assignee_person_id = '20000000-0000-0000-0000-000000000005'
    and title = 'งานทดสอบยกเลิกระหว่างจับเวลา'
  order by created_at desc
  limit 1;

  perform acknowledge_task(manual_id);
  perform start_task(manual_id);
  perform clock_in();
  perform start_task_timer(manual_id);

  if not exists (
    select 1 from task_time_entries
    where task_id = manual_id and ended_at is null
  ) then
    raise exception 'ASSERTION_FAILURE: setup failed, timer never started';
  end if;

  perform cancel_task_from_active_work(manual_id);

  if exists (
    select 1 from task_time_entries
    where task_id = manual_id and ended_at is null
  ) then
    raise exception 'ASSERTION_FAILURE: cancellation left an active timer running';
  end if;

  if not exists (
    select 1 from task_history
    where task_id = manual_id
      and field_name = 'status'
      and new_value = 'CANCELLED'
  ) then
    raise exception 'ASSERTION_FAILURE: cancellation did not record task_history';
  end if;

  if (select current_holder_person_id from tasks where id = manual_id) is not null then
    raise exception 'ASSERTION_FAILURE: cancelled task still has a current holder';
  end if;

  perform clock_out();
  raise notice 'OK: cancelling an in-progress task stops its timer, logs history, and clears the holder';
end;
$$;

reset app.current_uid;
select 'ALL TASK SELF MANAGEMENT CHECKS PASSED' as result;
