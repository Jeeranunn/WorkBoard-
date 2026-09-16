-- WorkBoard 2.0 — manual task / optional playbook acceptance checks.
-- Run after migrations 0001-0014 + seed.

-- MEMBER-A can add own work to a project in Organization A.
set app.current_uid = '10000000-0000-0000-0000-000000000005';
do $$
declare
  created tasks;
begin
  select * into created from create_manual_task(
    '50000000-0000-0000-0000-000000000001',
    'สมาชิกเพิ่มงานเอง',
    'งานจริงที่ไม่ได้มาจากร่างมาตรฐาน',
    null,
    null,
    null,
    null,
    now() + interval '2 days',
    1.5,
    true,
    false
  );

  if created.assignee_person_id <> '20000000-0000-0000-0000-000000000005' then
    raise exception 'ASSERTION_FAILURE: member-created task must assign to self';
  end if;
  if created.work_origin <> 'ADDED' or created.source <> 'MANUAL' then
    raise exception 'ASSERTION_FAILURE: manual task metadata incorrect';
  end if;
  raise notice 'OK: MEMBER-A can add own manual work';
end;
$$;

-- MEMBER-A cannot assign a manually-created task to another person.
do $$
begin
  perform create_manual_task(
    '50000000-0000-0000-0000-000000000001',
    'ห้ามมอบหมายแทน',
    null,
    null,
    '20000000-0000-0000-0000-000000000003',
    null,
    null,
    null,
    null,
    true,
    false
  );
  raise exception 'ASSERTION_FAILURE: MEMBER-A must not assign manual work to someone else';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: MEMBER-A blocked from assigning manual work to another person (%)', sqlerrm;
end;
$$;

-- MEMBER-A cannot nominate reviewer/approver directly.
do $
begin
  perform create_manual_task(
    '50000000-0000-0000-0000-000000000001',
    'ห้ามตั้งผู้ตรวจเอง',
    null,
    null,
    null,
    '20000000-0000-0000-0000-000000000003',
    null,
    null,
    null,
    true,
    false
  );
  raise exception 'ASSERTION_FAILURE: MEMBER-A must not assign reviewer on self-created work';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: member reviewer/approver assignment blocked (%)', sqlerrm;
end;
$;

-- MEMBER-A cannot add work to Organization B.
do $$
begin
  perform create_manual_task(
    '50000000-0000-0000-0000-000000000002',
    'ข้ามองค์กร',
    null, null, null, null, null, null, null, true, false
  );
  raise exception 'ASSERTION_FAILURE: MEMBER-A must not create work in Org B';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: cross-organization manual task creation blocked (%)', sqlerrm;
end;
$$;

-- HEAD-A can create and assign manual work to MEMBER-A.
set app.current_uid = '10000000-0000-0000-0000-000000000003';
do $$
declare
  created tasks;
begin
  select * into created from create_manual_task(
    '50000000-0000-0000-0000-000000000001',
    'หัวหน้าเพิ่มงานให้สมาชิก',
    null,
    '60000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000003',
    null,
    now() + interval '3 days',
    2,
    true,
    true
  );

  if created.assignee_person_id <> '20000000-0000-0000-0000-000000000005' then
    raise exception 'ASSERTION_FAILURE: HEAD assignment did not persist';
  end if;
  raise notice 'OK: HEAD-A can create and assign manual work in Org A';
end;
$$;

-- HEAD-A cannot assign Org A work to MEMBER-B from Org B.
do $$
begin
  perform create_manual_task(
    '50000000-0000-0000-0000-000000000001',
    'ข้ามองค์กร',
    null,
    null,
    '20000000-0000-0000-0000-000000000006',
    null,
    null,
    null,
    null,
    true,
    false
  );
  raise exception 'ASSERTION_FAILURE: HEAD-A must not assign Org A work to MEMBER-B';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: HEAD cross-organization assignment blocked (%)', sqlerrm;
end;
$$;

reset app.current_uid;
select 'ALL MANUAL TASK CHECKS PASSED' as result;
