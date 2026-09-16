-- WorkBoard 2.0 — Weekly Planner integration (0010) RLS verification.
--
-- Prerequisites: same as workflow_and_rls.sql — run supabase/seed.sql
-- first, then run this AS the app_test_user / authenticated role:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/weekly_planner_rls.sql
--
-- Focus after 0012_capacity_visibility.sql:
-- owners keep write control, while EXECUTIVE can read planner content for
-- capacity planning and HEAD can read only people in organizations they
-- oversee. Suggestions remain proposals that never mutate task priority.

-- ===========================================================================
-- 1. personal_planner_items — scoped management visibility, owner-only write.
-- ===========================================================================

set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A
insert into personal_planner_items (person_id, title, is_important, is_urgent)
values ('20000000-0000-0000-0000-000000000005', 'ส่วนตัว: จองห้องประชุม', true, false);

set app.current_uid = '10000000-0000-0000-0000-000000000006'; -- MEMBER-B
insert into personal_planner_items (person_id, title, is_important, is_urgent)
values ('20000000-0000-0000-0000-000000000006', 'ส่วนตัว: ซื้อของ', false, true);

set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A
do $$
declare
  n int;
begin
  select count(*) into n from personal_planner_items;
  if n <> 1 then
    raise exception 'ASSERTION_FAILURE: MEMBER-A should see only their own 1 personal item, saw %', n;
  end if;
  raise notice 'OK: MEMBER-A sees only their own personal_planner_items';
end;
$$;

-- A member cannot write someone else's personal item either.
do $$
declare
  v_title text;
begin
  update personal_planner_items set title = 'แอบแก้' where person_id = '20000000-0000-0000-0000-000000000006';
  select title into v_title from personal_planner_items where person_id = '20000000-0000-0000-0000-000000000006';
  if v_title = 'แอบแก้' then
    raise exception 'ASSERTION_FAILURE: MEMBER-A must not be able to write MEMBER-B''s personal item';
  end if;
  raise notice 'OK: MEMBER-A blocked (RLS-filtered, 0 rows) from writing MEMBER-B''s personal item';
end;
$$;

set app.current_uid = '10000000-0000-0000-0000-000000000002'; -- EXECUTIVE
do $
declare
  n int;
begin
  select count(*) into n from personal_planner_items;
  if n <> 2 then
    raise exception 'ASSERTION_FAILURE: EXECUTIVE should see all 2 personal_planner_items for capacity context, saw %', n;
  end if;
  raise notice 'OK: EXECUTIVE sees personal planner content for capacity planning';
end;
$;

set app.current_uid = '10000000-0000-0000-0000-000000000003'; -- HEAD-A
do $
declare
  n int;
begin
  select count(*) into n from personal_planner_items;
  if n <> 1 then
    raise exception 'ASSERTION_FAILURE: HEAD-A should see only MEMBER-A personal item, saw %', n;
  end if;
  if exists (
    select 1 from personal_planner_items
    where person_id = '20000000-0000-0000-0000-000000000006'
  ) then
    raise exception 'ASSERTION_FAILURE: HEAD-A must not see MEMBER-B personal item';
  end if;
  raise notice 'OK: HEAD-A sees planner content only inside Organization A';
end;
$;

set app.current_uid = '10000000-0000-0000-0000-000000000001'; -- ADMIN
do $$
declare
  n int;
begin
  select count(*) into n from personal_planner_items;
  if n <> 2 then
    raise exception 'ASSERTION_FAILURE: ADMIN should see all 2 personal_planner_items (support access), saw %', n;
  end if;
  raise notice 'OK: ADMIN retains access to all personal_planner_items (support/data admin convention)';
end;
$$;

-- ===========================================================================
-- 2. availability — self + chair oversight (not private like personal items).
-- ===========================================================================

set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A
insert into availability (person_id, date, start_time, end_time, status)
values ('20000000-0000-0000-0000-000000000005', current_date + 1, '09:00', '12:00', 'free');

set app.current_uid = '10000000-0000-0000-0000-000000000002'; -- EXECUTIVE
do $$
declare
  n int;
begin
  select count(*) into n from availability;
  if n <> 1 then
    raise exception 'ASSERTION_FAILURE: EXECUTIVE (chair) should see MEMBER-A''s availability for capacity oversight, saw %', n;
  end if;
  raise notice 'OK: EXECUTIVE (chair) can read availability (capacity oversight, not private)';
end;
$$;

do $$
declare
  v_status text;
begin
  update availability set status = 'busy' where person_id = '20000000-0000-0000-0000-000000000005';
  select status into v_status from availability where person_id = '20000000-0000-0000-0000-000000000005';
  if v_status = 'busy' then
    raise exception 'ASSERTION_FAILURE: EXECUTIVE must not be able to write another person''s availability';
  end if;
  raise notice 'OK: EXECUTIVE write to MEMBER-A''s availability silently filtered by RLS (status unchanged: %)', v_status;
end;
$$;

-- ===========================================================================
-- 3. planned_slots — dual source, ownership, and chair visibility rules.
-- ===========================================================================

set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A
do $$
declare
  v_item_id uuid;
begin
  select id into v_item_id from personal_planner_items where person_id = '20000000-0000-0000-0000-000000000005';

  -- Personal-item-backed slot.
  insert into planned_slots (person_id, personal_planner_item_id, date, start_time, end_time)
  values ('20000000-0000-0000-0000-000000000005', v_item_id, current_date + 1, '09:00', '10:00');

  -- WorkBoard-task-backed slot (t4 is assigned to MEMBER-A per seed).
  insert into planned_slots (person_id, workboard_task_id, date, start_time, end_time)
  values ('20000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000004', current_date + 1, '10:00', '11:00');

  raise notice 'OK: MEMBER-A created one personal-item slot and one WorkBoard-task slot';
end;
$$;

-- The dual-source CHECK constraint itself: neither both nor neither.
do $$
begin
  insert into planned_slots (person_id, date, start_time, end_time)
  values ('20000000-0000-0000-0000-000000000005', current_date + 1, '11:00', '12:00');
  raise exception 'ASSERTION_FAILURE: a planned_slot with neither source must be rejected';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: planned_slot with neither workboard_task_id nor personal_planner_item_id rejected (%)', sqlerrm;
end;
$$;

do $$
declare
  v_item_id uuid;
begin
  select id into v_item_id from personal_planner_items where person_id = '20000000-0000-0000-0000-000000000005';
  insert into planned_slots (person_id, workboard_task_id, personal_planner_item_id, date, start_time, end_time)
  values ('20000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000004', v_item_id, current_date + 1, '13:00', '14:00');
  raise exception 'ASSERTION_FAILURE: a planned_slot with both sources must be rejected';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: planned_slot with both sources rejected (%)', sqlerrm;
end;
$$;

-- Cannot schedule someone else's task or someone else's personal item.
do $$
begin
  insert into planned_slots (person_id, workboard_task_id, date, start_time, end_time)
  values ('20000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000002', current_date + 1, '14:00', '15:00'); -- t2 assigned to MEMBER-B
  raise exception 'ASSERTION_FAILURE: MEMBER-A must not schedule a task not assigned to them';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: MEMBER-A blocked from scheduling MEMBER-B''s task (%)', sqlerrm;
end;
$$;

set app.current_uid = '10000000-0000-0000-0000-000000000002'; -- EXECUTIVE
do $
declare
  n_total int; n_personal int;
begin
  select count(*) into n_total from planned_slots;
  select count(*) into n_personal from planned_slots where personal_planner_item_id is not null;
  if n_total <> 2 then
    raise exception 'ASSERTION_FAILURE: EXECUTIVE should see both planned slots for capacity, saw %', n_total;
  end if;
  if n_personal <> 1 then
    raise exception 'ASSERTION_FAILURE: EXECUTIVE should see the personal-item-backed slot, saw %', n_personal;
  end if;
  raise notice 'OK: EXECUTIVE sees formal and personal planned slots for capacity context';
end;
$;

set app.current_uid = '10000000-0000-0000-0000-000000000003'; -- HEAD-A
do $
declare
  n_total int;
begin
  select count(*) into n_total from planned_slots;
  if n_total <> 2 then
    raise exception 'ASSERTION_FAILURE: HEAD-A should see MEMBER-A planned slots, saw %', n_total;
  end if;
  raise notice 'OK: HEAD-A sees planned slots for people in Organization A';
end;
$;

-- ===========================================================================
-- 4. suggestions — proposal only, never writes back to tasks directly.
-- ===========================================================================

set app.current_uid = '10000000-0000-0000-0000-000000000002'; -- EXECUTIVE (chair)
do $$
declare
  v_before_important boolean; v_before_urgent boolean;
begin
  select is_important, is_urgent into v_before_important, v_before_urgent
    from tasks where id = '70000000-0000-0000-0000-000000000004';

  insert into suggestions (task_id, suggested_by, suggested_is_important, suggested_is_urgent, reason)
  values ('70000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', true, true, 'เสนอปรับความสำคัญ');

  if (select is_important from tasks where id = '70000000-0000-0000-0000-000000000004') <> v_before_important
     or (select is_urgent from tasks where id = '70000000-0000-0000-0000-000000000004') <> v_before_urgent then
    raise exception 'ASSERTION_FAILURE: creating a suggestion must not change the task''s own importance/urgency';
  end if;
  raise notice 'OK: EXECUTIVE (chair) created a suggestion; task''s own is_important/is_urgent untouched';
end;
$$;

-- A non-chair cannot insert a suggestion.
set app.current_uid = '10000000-0000-0000-0000-000000000003'; -- HEAD-A (org-scoped, not chair)
do $$
begin
  insert into suggestions (task_id, suggested_by, suggested_is_important, suggested_is_urgent)
  values ('70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', true, false);
  raise exception 'ASSERTION_FAILURE: HEAD-A (org-scoped, not chair) must not be able to insert a suggestion';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: HEAD-A (not chair) blocked from inserting a suggestion (%)', sqlerrm;
end;
$$;

-- The task owner (MEMBER-A, assignee of t4) responds via the RPC.
set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A
do $$
declare
  v_suggestion_id uuid;
  v_before_important boolean; v_before_urgent boolean;
begin
  select id into v_suggestion_id from suggestions where task_id = '70000000-0000-0000-0000-000000000004' order by created_at desc limit 1;
  select is_important, is_urgent into v_before_important, v_before_urgent
    from tasks where id = '70000000-0000-0000-0000-000000000004';

  perform respond_to_suggestion(v_suggestion_id, 'accepted');

  if (select status from suggestions where id = v_suggestion_id) <> 'accepted' then
    raise exception 'ASSERTION_FAILURE: expected suggestion status accepted';
  end if;
  if (select is_important from tasks where id = '70000000-0000-0000-0000-000000000004') <> v_before_important
     or (select is_urgent from tasks where id = '70000000-0000-0000-0000-000000000004') <> v_before_urgent then
    raise exception 'ASSERTION_FAILURE: accepting a suggestion must not itself write tasks.is_important/is_urgent';
  end if;
  raise notice 'OK: MEMBER-A accepted the suggestion via respond_to_suggestion(); task columns still untouched (proposal only)';
end;
$$;

-- Responding twice must fail (immutable once answered).
do $$
declare
  v_suggestion_id uuid;
begin
  select id into v_suggestion_id from suggestions where task_id = '70000000-0000-0000-0000-000000000004' order by created_at desc limit 1;
  perform respond_to_suggestion(v_suggestion_id, 'rejected');
  raise exception 'ASSERTION_FAILURE: responding to an already-answered suggestion must be rejected';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: second response to an already-answered suggestion rejected (%)', sqlerrm;
end;
$$;

-- An uninvolved member cannot respond to someone else's suggestion.
set app.current_uid = '10000000-0000-0000-0000-000000000002'; -- EXECUTIVE (chair)
do $$
begin
  insert into suggestions (task_id, suggested_by, suggested_is_important, suggested_is_urgent)
  values ('70000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', false, false);
end;
$$;

set app.current_uid = '10000000-0000-0000-0000-000000000006'; -- MEMBER-B (not t3's assignee)
do $$
declare
  v_suggestion_id uuid;
begin
  select id into v_suggestion_id from suggestions where task_id = '70000000-0000-0000-0000-000000000003' order by created_at desc limit 1;
  perform respond_to_suggestion(v_suggestion_id, 'accepted');
  raise exception 'ASSERTION_FAILURE: an uninvolved person must not respond to someone else''s suggestion';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: uninvolved MEMBER-B blocked from responding to another assignee''s suggestion (%)', sqlerrm;
end;
$$;

reset app.current_uid;
select 'ALL WEEKLY PLANNER CHECKS PASSED' as result;
