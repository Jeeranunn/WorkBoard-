-- WorkBoard 2.0 — role acceptance smoke test (after migrations 0001-0013 + seed).
-- Run as the authenticated test role with app.current_uid support from seed/test harness.

-- MEMBER-A: sees own formal work and own planner data, not Org B private work.
set app.current_uid = '10000000-0000-0000-0000-000000000005';
do $$
declare
  n int;
begin
  select count(*) into n
  from personal_planner_items
  where person_id = '20000000-0000-0000-0000-000000000006';
  if n <> 0 then
    raise exception 'ASSERTION_FAILURE: MEMBER-A can see MEMBER-B personal planner content';
  end if;

  if not exists (
    select 1 from tasks
    where assignee_person_id = '20000000-0000-0000-0000-000000000005'
  ) then
    raise exception 'ASSERTION_FAILURE: MEMBER-A cannot see own assigned work';
  end if;

  raise notice 'OK: MEMBER scope';
end;
$$;

-- HEAD-A: can see capacity/planner context for Org A people, never Org B.
set app.current_uid = '10000000-0000-0000-0000-000000000003';
do $$
declare
  n_a int;
  n_b int;
begin
  select count(*) into n_a
  from personal_planner_items
  where person_id = '20000000-0000-0000-0000-000000000005';

  select count(*) into n_b
  from personal_planner_items
  where person_id = '20000000-0000-0000-0000-000000000006';

  if n_a < 1 then
    raise exception 'ASSERTION_FAILURE: HEAD-A cannot see Org A planner context';
  end if;
  if n_b <> 0 then
    raise exception 'ASSERTION_FAILURE: HEAD-A can see Org B planner context';
  end if;

  raise notice 'OK: HEAD organization scope';
end;
$$;

-- EXECUTIVE: global read for capacity context, but no write authority over
-- another person's planner item.
set app.current_uid = '10000000-0000-0000-0000-000000000002';
do $$
declare
  before_title text;
  after_title text;
begin
  select title into before_title
  from personal_planner_items
  where person_id = '20000000-0000-0000-0000-000000000005'
  order by created_at
  limit 1;

  if before_title is null then
    raise exception 'ASSERTION_FAILURE: EXECUTIVE cannot read planner capacity context';
  end if;

  update personal_planner_items
  set title = 'EXECUTIVE SHOULD NOT WRITE'
  where person_id = '20000000-0000-0000-0000-000000000005';

  select title into after_title
  from personal_planner_items
  where person_id = '20000000-0000-0000-0000-000000000005'
  order by created_at
  limit 1;

  if after_title = 'EXECUTIVE SHOULD NOT WRITE' then
    raise exception 'ASSERTION_FAILURE: EXECUTIVE gained planner write access';
  end if;

  raise notice 'OK: EXECUTIVE read-only capacity scope';
end;
$$;

-- ADMIN: global support read still works.
set app.current_uid = '10000000-0000-0000-0000-000000000001';
do $$
declare
  n int;
begin
  select count(*) into n from personal_planner_items;
  if n < 2 then
    raise exception 'ASSERTION_FAILURE: ADMIN cannot read all planner rows';
  end if;
  raise notice 'OK: ADMIN support scope';
end;
$$;

reset app.current_uid;
select 'ALL FOUR ROLE ACCEPTANCE CHECKS PASSED' as result;
