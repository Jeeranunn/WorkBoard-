-- WorkBoard 2.0 — planner schedule integrity checks.
-- Run after migrations 0001-0017 + seed.

set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A

insert into personal_planner_items (
  id, person_id, title, is_important, is_urgent
) values (
  '91000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000005',
  'งานส่วนตัวสำหรับทดสอบตาราง',
  true,
  false
) on conflict (id) do nothing;

insert into planned_slots (
  person_id, personal_planner_item_id, date, start_time, end_time
) values (
  '20000000-0000-0000-0000-000000000005',
  '91000000-0000-0000-0000-000000000001',
  current_date + 5,
  '09:00',
  '10:00'
);

do $$
begin
  insert into planned_slots (
    person_id, personal_planner_item_id, date, start_time, end_time
  ) values (
    '20000000-0000-0000-0000-000000000005',
    '91000000-0000-0000-0000-000000000001',
    current_date + 5,
    '09:30',
    '10:30'
  );
  raise exception 'ASSERTION_FAILURE: overlapping planned slots must be rejected';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: overlapping planned slot rejected (%)', sqlerrm;
end;
$$;

do $$
begin
  insert into planned_slots (
    person_id, personal_planner_item_id, date, start_time, end_time
  ) values (
    '20000000-0000-0000-0000-000000000005',
    '91000000-0000-0000-0000-000000000001',
    current_date + 5,
    '11:00',
    '11:00'
  );
  raise exception 'ASSERTION_FAILURE: zero-length planned slot must be rejected';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: zero-length planned slot rejected (%)', sqlerrm;
end;
$$;

insert into availability (
  person_id, date, start_time, end_time, status, note
) values (
  '20000000-0000-0000-0000-000000000005',
  current_date + 6,
  '13:00',
  '15:00',
  'busy',
  'ทดสอบ'
);

do $$
begin
  insert into availability (
    person_id, date, start_time, end_time, status
  ) values (
    '20000000-0000-0000-0000-000000000005',
    current_date + 6,
    '14:00',
    '16:00',
    'free'
  );
  raise exception 'ASSERTION_FAILURE: overlapping availability must be rejected';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: overlapping availability rejected (%)', sqlerrm;
end;
$$;

reset app.current_uid;
select 'ALL PLANNER SCHEDULE INTEGRITY CHECKS PASSED' as result;
