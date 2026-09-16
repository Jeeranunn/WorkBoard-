-- WorkBoard 2.0 — Automated verification against the seeded test data.
--
-- Prerequisites: run supabase/seed.sql first. Run this AS a non-superuser,
-- non-bypassrls role granted the `authenticated` privileges (so RLS
-- actually applies, matching how PostgREST connects) — e.g. the
-- app_test_user / authenticated setup described in
-- docs/testing-checklist.md for local Postgres, or any authenticated
-- Supabase connection for a real project.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/workflow_and_rls.sql
--
-- Prints "OK: ..." for each passing check. Aborts with an error on the
-- first failing one (either an unexpected RPC error, or an explicit
-- ASSERTION_FAILURE for a check that should have failed but didn't).

-- ===========================================================================
-- 1. Project/Task visibility (RLS) — no mutations.
-- ===========================================================================

set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A
do $$
declare
  n int;
begin
  select count(*) into n from tasks;
  if n <> 3 then
    raise exception 'ASSERTION_FAILURE: MEMBER-A should see 3 tasks (t1,t3,t4), saw %', n;
  end if;
  if exists (select 1 from tasks where id = '70000000-0000-0000-0000-000000000002') then
    raise exception 'ASSERTION_FAILURE: MEMBER-A must not see Org B task t2';
  end if;
  raise notice 'OK: MEMBER-A sees exactly their 3 own tasks, not Org B''s t2';
end;
$$;

set app.current_uid = '10000000-0000-0000-0000-000000000003'; -- HEAD-A
do $$
declare
  n int;
begin
  select count(*) into n from projects;
  if n <> 1 then
    raise exception 'ASSERTION_FAILURE: HEAD-A should see exactly 1 project (Org A), saw %', n;
  end if;
  select count(*) into n from tasks;
  if n <> 3 then
    raise exception 'ASSERTION_FAILURE: HEAD-A should see 3 Org A tasks, saw %', n;
  end if;
  raise notice 'OK: HEAD-A sees only Org A''s project and tasks';
end;
$$;

set app.current_uid = '10000000-0000-0000-0000-000000000002'; -- EXECUTIVE
do $$
declare
  n int;
begin
  select count(*) into n from projects;
  if n <> 2 then
    raise exception 'ASSERTION_FAILURE: EXECUTIVE should see all 2 projects, saw %', n;
  end if;
  select count(*) into n from tasks;
  if n <> 4 then
    raise exception 'ASSERTION_FAILURE: EXECUTIVE should see all 4 tasks, saw %', n;
  end if;
  raise notice 'OK: EXECUTIVE sees everything (read)';
end;
$$;

-- RLS filters rows an UPDATE's USING clause doesn't match rather than
-- raising an error, so a blocked write looks like "0 rows affected," not
-- an exception — check row count, not an exception.
do $$
declare
  v_name text;
begin
  update projects set name = 'ควรถูกปฏิเสธ' where id = '50000000-0000-0000-0000-000000000001';
  select name into v_name from projects where id = '50000000-0000-0000-0000-000000000001';
  if v_name = 'ควรถูกปฏิเสธ' then
    raise exception 'ASSERTION_FAILURE: EXECUTIVE must not be able to write projects';
  end if;
  raise notice 'OK: EXECUTIVE write to projects silently filtered by RLS (name unchanged: %)', v_name;
end;
$$;

-- ===========================================================================
-- 2. Full workflow transition sequence on t1 (reviewer=HEAD-A,
--    approver=EXECUTIVE) — includes the Milestone 3.1 regression checks.
-- ===========================================================================

set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A
select acknowledge_task('70000000-0000-0000-0000-000000000001');
select start_task('70000000-0000-0000-0000-000000000001');
select submit_task('70000000-0000-0000-0000-000000000001', 'ส่งงานรอบแรก', 'https://example.com/v1');

do $$
declare
  v_status text; v_holder uuid;
begin
  select status, current_holder_person_id into v_status, v_holder
    from tasks where id = '70000000-0000-0000-0000-000000000001';
  if v_status <> 'SUBMITTED' or v_holder <> '20000000-0000-0000-0000-000000000003' then
    raise exception 'ASSERTION_FAILURE: expected SUBMITTED held by HEAD-A, got % / %', v_status, v_holder;
  end if;
  raise notice 'OK: t1 SUBMITTED, holder = HEAD-A (reviewer)';
end;
$$;

set app.current_uid = '10000000-0000-0000-0000-000000000003'; -- HEAD-A
select begin_review('70000000-0000-0000-0000-000000000001');
select request_revision('70000000-0000-0000-0000-000000000001', 'ข้อมูลไม่ครบ กรุณาเพิ่มรายละเอียด');

set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A
select resubmit_task('70000000-0000-0000-0000-000000000001', 'แก้ไขแล้ว', 'https://example.com/v2');

set app.current_uid = '10000000-0000-0000-0000-000000000003'; -- HEAD-A
select begin_review('70000000-0000-0000-0000-000000000001');

-- The core Milestone 3.1 regression check: reviewer must NOT be able to
-- approve directly once an approver is set on the task.
do $$
begin
  perform approve_task('70000000-0000-0000-0000-000000000001');
  raise exception 'ASSERTION_FAILURE: HEAD-A (reviewer) must not approve when approver is set';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: HEAD-A blocked from approving directly (%)', sqlerrm;
end;
$$;

select submit_for_approval('70000000-0000-0000-0000-000000000001');

do $$
declare
  v_status text; v_holder uuid;
begin
  select status, current_holder_person_id into v_status, v_holder
    from tasks where id = '70000000-0000-0000-0000-000000000001';
  if v_status <> 'PENDING_APPROVAL' or v_holder <> '20000000-0000-0000-0000-000000000002' then
    raise exception 'ASSERTION_FAILURE: expected PENDING_APPROVAL held by EXECUTIVE, got % / %', v_status, v_holder;
  end if;
  raise notice 'OK: t1 PENDING_APPROVAL, holder = EXECUTIVE (approver)';
end;
$$;

-- Note: HEAD-A is org-HEAD for Org A, so is_task_holder_side_actor's
-- override clause means HEAD-A *can* still approve here by design ("HEAD/
-- ADMIN override ได้ตาม policy เดิม" — unchanged since Milestone 3). That's
-- intentional, not the bug 3.1 fixed, so it isn't asserted against here.
-- What must be blocked is someone with neither the holder role nor any
-- override — e.g. MEMBER-B, who has no relationship to this task at all.
set app.current_uid = '10000000-0000-0000-0000-000000000006'; -- MEMBER-B
do $$
begin
  perform approve_task('70000000-0000-0000-0000-000000000001');
  raise exception 'ASSERTION_FAILURE: an uninvolved person must not approve';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: uninvolved MEMBER-B blocked from approving at PENDING_APPROVAL (%)', sqlerrm;
end;
$$;

set app.current_uid = '10000000-0000-0000-0000-000000000002'; -- EXECUTIVE
select approve_task('70000000-0000-0000-0000-000000000001');

do $$
declare
  v_status text; v_holder uuid;
begin
  select status, current_holder_person_id into v_status, v_holder
    from tasks where id = '70000000-0000-0000-0000-000000000001';
  if v_status <> 'APPROVED' or v_holder is not null then
    raise exception 'ASSERTION_FAILURE: expected APPROVED with null holder, got % / %', v_status, v_holder;
  end if;
  raise notice 'OK: t1 APPROVED by EXECUTIVE, holder cleared to null';
end;
$$;

set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A
select complete_task('70000000-0000-0000-0000-000000000001');

do $$
declare
  v_status text;
begin
  select status into v_status from tasks where id = '70000000-0000-0000-0000-000000000001';
  if v_status <> 'COMPLETED' then
    raise exception 'ASSERTION_FAILURE: expected COMPLETED, got %', v_status;
  end if;
  raise notice 'OK: t1 COMPLETED end to end';
end;
$$;

-- ===========================================================================
-- 3. t2 (Org B, no approver) — direct-approve path, case C.
-- ===========================================================================

set app.current_uid = '10000000-0000-0000-0000-000000000006'; -- MEMBER-B
select acknowledge_task('70000000-0000-0000-0000-000000000002');
select start_task('70000000-0000-0000-0000-000000000002');
select submit_task('70000000-0000-0000-0000-000000000002', 'ส่งงาน', null);

set app.current_uid = '10000000-0000-0000-0000-000000000004'; -- HEAD-B
select begin_review('70000000-0000-0000-0000-000000000002');
select approve_task('70000000-0000-0000-0000-000000000002'); -- no approver set: direct approve must succeed

do $$
declare
  v_status text;
begin
  select status into v_status from tasks where id = '70000000-0000-0000-0000-000000000002';
  if v_status <> 'APPROVED' then
    raise exception 'ASSERTION_FAILURE: expected t2 APPROVED via direct reviewer approval, got %', v_status;
  end if;
  raise notice 'OK: t2 approved directly by reviewer (no approver on task)';
end;
$$;

-- Cross-org check: HEAD-A must not be able to touch Org B's task.
set app.current_uid = '10000000-0000-0000-0000-000000000003'; -- HEAD-A
do $$
begin
  perform request_revision('70000000-0000-0000-0000-000000000002', 'พยายามยุ่งกับงานองค์กรอื่น');
  raise exception 'ASSERTION_FAILURE: HEAD-A must not act on Org B''s task';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: HEAD-A blocked from acting on Org B task (%)', sqlerrm;
end;
$$;

-- ===========================================================================
-- 4. Time tracking sequence (MEMBER-A).
-- Timers now require a working task state, so move t4/t3 into IN_PROGRESS.
-- ===========================================================================

set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A
select acknowledge_task('70000000-0000-0000-0000-000000000004');
select start_task('70000000-0000-0000-0000-000000000004');
select acknowledge_task('70000000-0000-0000-0000-000000000003');
select start_task('70000000-0000-0000-0000-000000000003');
select clock_in();

do $$
begin
  perform clock_in();
  raise exception 'ASSERTION_FAILURE: double clock-in must be rejected';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: double Clock In rejected (%)', sqlerrm;
end;
$$;

select start_break();
select resume_from_break();
select start_task_timer('70000000-0000-0000-0000-000000000004'); -- t4

do $$
begin
  perform start_task_timer('70000000-0000-0000-0000-000000000003'); -- t3, while t4 is active
  raise exception 'ASSERTION_FAILURE: a second concurrent task timer must be rejected';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: second concurrent task timer rejected (%)', sqlerrm;
end;
$$;

select switch_task_timer('70000000-0000-0000-0000-000000000003'); -- t3

do $$
declare
  n int;
begin
  select count(*) into n from task_time_entries
    where person_id = '20000000-0000-0000-0000-000000000005' and ended_at is null
      and task_id = '70000000-0000-0000-0000-000000000003';
  if n <> 1 then
    raise exception 'ASSERTION_FAILURE: expected exactly one active timer, on t3, got %', n;
  end if;
  raise notice 'OK: switch_task_timer moved the active timer from t4 to t3';
end;
$$;

select pause_task_timer();
select clock_out();

do $$
declare
  n int;
begin
  select count(*) into n from task_time_entries
    where person_id = '20000000-0000-0000-0000-000000000005' and ended_at is null;
  if n <> 0 then
    raise exception 'ASSERTION_FAILURE: expected no active task timer after Clock Out, got %', n;
  end if;
  raise notice 'OK: Clock Out closed the active task timer';
end;
$$;

-- ===========================================================================
-- 5. Cross-org time RLS.
-- ===========================================================================

set app.current_uid = '10000000-0000-0000-0000-000000000004'; -- HEAD-B
do $$
declare
  n int;
begin
  select count(*) into n from attendance_sessions
    where person_id = '20000000-0000-0000-0000-000000000005'; -- MEMBER-A, Org A
  if n <> 0 then
    raise exception 'ASSERTION_FAILURE: HEAD-B must not see Org A member''s attendance, saw % rows', n;
  end if;
  raise notice 'OK: HEAD-B sees none of MEMBER-A''s (Org A) attendance rows';
end;
$$;

set app.current_uid = '10000000-0000-0000-0000-000000000003'; -- HEAD-A
do $$
declare
  n int;
begin
  select count(*) into n from attendance_sessions
    where person_id = '20000000-0000-0000-0000-000000000005';
  if n = 0 then
    raise exception 'ASSERTION_FAILURE: HEAD-A should see MEMBER-A''s (own org) attendance';
  end if;
  raise notice 'OK: HEAD-A sees MEMBER-A''s (own org) attendance';
end;
$$;

-- ===========================================================================
-- 6. Corrections.
-- ===========================================================================

set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A
do $$
declare
  v_session_id uuid;
begin
  select id into v_session_id from attendance_sessions
    where person_id = '20000000-0000-0000-0000-000000000005'
    order by created_at desc limit 1;
  perform correct_attendance_session(v_session_id, now() - interval '9 hours', now() - interval '1 hour', 'ลืมบันทึกเวลาที่ถูกต้อง');
  if (select source from attendance_sessions where id = v_session_id) <> 'SELF_DECLARED' then
    raise exception 'ASSERTION_FAILURE: self-correction must set source SELF_DECLARED';
  end if;
  raise notice 'OK: MEMBER-A self-corrected their own session -> SELF_DECLARED';
end;
$$;

set app.current_uid = '10000000-0000-0000-0000-000000000004'; -- HEAD-B
do $$
declare
  v_session_id uuid;
begin
  select id into v_session_id from attendance_sessions
    where person_id = '20000000-0000-0000-0000-000000000005'
    order by created_at desc limit 1;
  -- Strongest possible outcome: HEAD-B can't even see the row (RLS scopes
  -- read access too), so there's nothing to attempt correcting.
  if v_session_id is null then
    raise notice 'OK: HEAD-B cannot see Org A member''s session at all (RLS)';
    return;
  end if;

  perform correct_attendance_session(v_session_id, now(), now(), 'พยายามแก้ข้ามองค์กร');
  raise exception 'ASSERTION_FAILURE: HEAD-B must not correct an Org A member''s time entry';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: HEAD-B blocked from correcting Org A member''s entry (%)', sqlerrm;
end;
$$;

set app.current_uid = '10000000-0000-0000-0000-000000000003'; -- HEAD-A
do $$
declare
  v_session_id uuid;
begin
  select id into v_session_id from attendance_sessions
    where person_id = '20000000-0000-0000-0000-000000000005'
    order by created_at desc limit 1;
  perform correct_attendance_session(v_session_id, now() - interval '8 hours', now() - interval '30 minutes', 'หัวหน้าปรับเวลาให้');
  if (select source from attendance_sessions where id = v_session_id) <> 'RECONSTRUCTED' then
    raise exception 'ASSERTION_FAILURE: HEAD correction must set source RECONSTRUCTED';
  end if;
  raise notice 'OK: HEAD-A (own org) corrected MEMBER-A''s session -> RECONSTRUCTED';
end;
$$;

set app.current_uid = '10000000-0000-0000-0000-000000000002'; -- EXECUTIVE
do $$
declare
  v_session_id uuid;
begin
  select id into v_session_id from attendance_sessions
    where person_id = '20000000-0000-0000-0000-000000000005'
    order by created_at desc limit 1;
  if v_session_id is not null then
    perform correct_attendance_session(v_session_id, now(), now(), 'ประธานไม่ควรแก้ได้');
  end if;
  raise exception 'ASSERTION_FAILURE: EXECUTIVE must have no correction authority';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    raise notice 'OK: EXECUTIVE blocked from correcting any time entry (%)', sqlerrm;
end;
$$;

reset app.current_uid;
select 'ALL CHECKS PASSED' as result;
