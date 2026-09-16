-- WorkBoard 2.0 — planner CRUD lifecycle checks.
-- Run after migrations 0001-0024 + seed.

set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A

insert into personal_planner_items (
  id, person_id, title, notes, is_important, is_urgent
) values (
  '92000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000005',
  'งานส่วนตัวเดิม',
  'รายละเอียดเดิม',
  true,
  false
);

update personal_planner_items
set
  title = 'งานส่วนตัวแก้แล้ว',
  notes = 'รายละเอียดใหม่',
  estimated_hours = 2.5
where id = '92000000-0000-0000-0000-000000000001';

do $$
begin
  if not exists (
    select 1
    from personal_planner_items
    where id = '92000000-0000-0000-0000-000000000001'
      and title = 'งานส่วนตัวแก้แล้ว'
      and notes = 'รายละเอียดใหม่'
      and estimated_hours = 2.5
  ) then
    raise exception 'ASSERTION_FAILURE: personal item update did not persist';
  end if;
  raise notice 'OK: personal item can be edited by owner';
end;
$$;

insert into planned_slots (
  id, person_id, personal_planner_item_id, date, start_time, end_time
) values (
  '92000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000005',
  '92000000-0000-0000-0000-000000000001',
  current_date + 3,
  '09:00',
  '10:00'
);

update planned_slots
set
  date = current_date + 4,
  start_time = '13:00',
  end_time = '14:30'
where id = '92000000-0000-0000-0000-000000000002';

do $$
begin
  if not exists (
    select 1
    from planned_slots
    where id = '92000000-0000-0000-0000-000000000002'
      and date = current_date + 4
      and start_time = '13:00'
      and end_time = '14:30'
  ) then
    raise exception 'ASSERTION_FAILURE: planned slot reschedule did not persist';
  end if;
  raise notice 'OK: planned slot can be rescheduled by owner';
end;
$$;

insert into availability (
  id, person_id, date, start_time, end_time, status, note
) values (
  '92000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000005',
  current_date + 5,
  '15:00',
  '17:00',
  'busy',
  'เหตุผลเดิม'
);

update availability
set
  start_time = '14:00',
  end_time = '16:00',
  status = 'maybe',
  note = 'เหตุผลใหม่'
where id = '92000000-0000-0000-0000-000000000003';

do $$
begin
  if not exists (
    select 1
    from availability
    where id = '92000000-0000-0000-0000-000000000003'
      and start_time = '14:00'
      and end_time = '16:00'
      and status = 'maybe'
      and note = 'เหตุผลใหม่'
  ) then
    raise exception 'ASSERTION_FAILURE: availability update did not persist';
  end if;
  raise notice 'OK: availability can be edited by owner';
end;
$$;

-- Another member cannot update or delete MEMBER-A planner data.
set app.current_uid = '10000000-0000-0000-0000-000000000006'; -- MEMBER-B

update personal_planner_items
set title = 'SHOULD NOT CHANGE'
where id = '92000000-0000-0000-0000-000000000001';

delete from availability
where id = '92000000-0000-0000-0000-000000000003';

set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A

do $$
begin
  if exists (
    select 1
    from personal_planner_items
    where id = '92000000-0000-0000-0000-000000000001'
      and title = 'SHOULD NOT CHANGE'
  ) then
    raise exception 'ASSERTION_FAILURE: other member updated personal planner item';
  end if;

  if not exists (
    select 1
    from availability
    where id = '92000000-0000-0000-0000-000000000003'
  ) then
    raise exception 'ASSERTION_FAILURE: other member deleted availability';
  end if;

  raise notice 'OK: planner writes remain owner-scoped';
end;
$$;

-- Deleting a personal item intentionally cascades its planned slots so no
-- orphan schedule remains.
delete from personal_planner_items
where id = '92000000-0000-0000-0000-000000000001';

do $$
begin
  if exists (
    select 1
    from planned_slots
    where id = '92000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'ASSERTION_FAILURE: deleting personal item left orphan planned slot';
  end if;
  raise notice 'OK: deleting personal item cascades its planned slots';
end;
$$;

delete from availability
where id = '92000000-0000-0000-0000-000000000003';

reset app.current_uid;
select 'ALL PLANNER CRUD CHECKS PASSED' as result;
