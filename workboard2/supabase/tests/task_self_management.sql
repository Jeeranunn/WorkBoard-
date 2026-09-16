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

reset app.current_uid;
select 'ALL TASK SELF MANAGEMENT CHECKS PASSED' as result;
