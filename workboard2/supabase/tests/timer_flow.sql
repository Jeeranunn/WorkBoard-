-- WorkBoard 2.0 — Task timer regression suite.
--
-- Written after a production report of "กดเริ่มจับเวลาแล้วไม่เริ่ม" (clicking
-- start does nothing). Root cause: start_task_timer()/switch_task_timer()'s
-- preconditions (assignee-side actor, clocked in, not on break, no other
-- active timer) were all correct, but the Server Actions calling them threw
-- on error with no way for the page to display the message — a rejected
-- call looked identical to a silently broken button. This suite locks down
-- every precondition's actual behavior at the RPC/RLS layer (the UI fix
-- itself — useActionState in src/components/tasks/timer-action-form.tsx —
-- has no SQL to test).
--
-- Prerequisites: run supabase/seed.sql first. Run this AS app_test_user
-- (same harness as workflow_and_rls.sql/weekly_planner_rls.sql). Safe to
-- run standalone against a fresh seed, or right after workflow_and_rls.sql
-- in the same database — it only depends on MEMBER-A not currently being
-- clocked in, which holds either way (fresh seed, or that suite's own
-- clock_out() at the end of its timer section).
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/timer_flow.sql

-- ===========================================================================
-- 1. Precondition: must be clocked in before a timer can start at all.
-- ===========================================================================

set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A
do $$
begin
  perform start_task_timer('70000000-0000-0000-0000-000000000004'); -- t4, MEMBER-A's own task
  raise exception 'ASSERTION_FAILURE: starting a timer before Clock In must be rejected';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    if sqlerrm <> 'ต้อง Clock In ก่อนเริ่มจับเวลางาน' then
      raise exception 'ASSERTION_FAILURE: expected the Clock-In message, got: %', sqlerrm;
    end if;
    raise notice 'OK: start_task_timer rejected before Clock In (%)', sqlerrm;
end;
$$;

-- ===========================================================================
-- 2. Full happy path: start -> running -> pause -> start again -> switch.
-- ===========================================================================

select clock_in();
select start_task_timer('70000000-0000-0000-0000-000000000004'); -- t4

do $$
declare
  n int;
begin
  select count(*) into n from task_time_entries
    where person_id = '20000000-0000-0000-0000-000000000005'
      and task_id = '70000000-0000-0000-0000-000000000004'
      and ended_at is null;
  if n <> 1 then
    raise exception 'ASSERTION_FAILURE: expected 1 running entry on t4, got %', n;
  end if;
  raise notice 'OK: start_task_timer put t4 into the running state';
end;
$$;

select pause_task_timer();

do $$
declare
  n int;
begin
  select count(*) into n from task_time_entries
    where person_id = '20000000-0000-0000-0000-000000000005' and ended_at is null;
  if n <> 0 then
    raise exception 'ASSERTION_FAILURE: expected no running entry after pause, got %', n;
  end if;
  raise notice 'OK: pause_task_timer stopped it (no running entry left)';
end;
$$;

-- Restarting after a pause must work — this is the exact "start ใหม่" step
-- of the reported flow, and the one most likely to have silently failed
-- if e.g. the prior paused entry had been left in a state that tripped the
-- "already has an active timer" check.
select start_task_timer('70000000-0000-0000-0000-000000000004'); -- t4 again

do $$
declare
  n int;
begin
  select count(*) into n from task_time_entries
    where person_id = '20000000-0000-0000-0000-000000000005'
      and task_id = '70000000-0000-0000-0000-000000000004'
      and ended_at is null;
  if n <> 1 then
    raise exception 'ASSERTION_FAILURE: expected t4 running again after restart, got %', n;
  end if;
  raise notice 'OK: start_task_timer restarted t4 cleanly after a pause';
end;
$$;

select switch_task_timer('70000000-0000-0000-0000-000000000003'); -- t3

do $$
declare
  n_t4 int;
  n_t3 int;
begin
  select count(*) into n_t4 from task_time_entries
    where person_id = '20000000-0000-0000-0000-000000000005'
      and task_id = '70000000-0000-0000-0000-000000000004' and ended_at is null;
  select count(*) into n_t3 from task_time_entries
    where person_id = '20000000-0000-0000-0000-000000000005'
      and task_id = '70000000-0000-0000-0000-000000000003' and ended_at is null;
  if n_t4 <> 0 or n_t3 <> 1 then
    raise exception 'ASSERTION_FAILURE: expected t4 stopped and t3 running, got t4=% t3=%', n_t4, n_t3;
  end if;
  raise notice 'OK: switch_task_timer moved the running entry from t4 to t3';
end;
$$;

-- ===========================================================================
-- 3. Precondition: on break blocks both start and switch (checked before
--    the concurrent-timer check, so this holds even with t3 mid-timer).
-- ===========================================================================

select start_break();

do $$
begin
  perform start_task_timer('70000000-0000-0000-0000-000000000004');
  raise exception 'ASSERTION_FAILURE: starting a timer while on break must be rejected';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    if sqlerrm <> 'กำลังพักอยู่ ไม่สามารถเริ่มจับเวลางานได้' then
      raise exception 'ASSERTION_FAILURE: expected the on-break message, got: %', sqlerrm;
    end if;
    raise notice 'OK: start_task_timer rejected while on break (%)', sqlerrm;
end;
$$;

do $$
begin
  perform switch_task_timer('70000000-0000-0000-0000-000000000004');
  raise exception 'ASSERTION_FAILURE: switching timers while on break must be rejected';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    if sqlerrm <> 'กำลังพักอยู่ ไม่สามารถเริ่มจับเวลางานได้' then
      raise exception 'ASSERTION_FAILURE: expected the on-break message, got: %', sqlerrm;
    end if;
    raise notice 'OK: switch_task_timer rejected while on break (%)', sqlerrm;
end;
$$;

select resume_from_break();
select pause_task_timer(); -- stop t3's timer before the permission checks below

-- ===========================================================================
-- 4. Permission: only the assignee, an org-HEAD, or ADMIN may touch the
--    timer for a task — an uninvolved person must be rejected outright,
--    before their own attendance state is even considered.
-- ===========================================================================

set app.current_uid = '10000000-0000-0000-0000-000000000006'; -- MEMBER-B, Org B, uninvolved in t4
do $$
begin
  perform start_task_timer('70000000-0000-0000-0000-000000000004');
  raise exception 'ASSERTION_FAILURE: an uninvolved person must not start a timer on someone else''s task';
exception
  when others then
    if sqlerrm like 'ASSERTION_FAILURE%' then raise; end if;
    if sqlerrm <> 'ไม่มีสิทธิ์จับเวลางานนี้' then
      raise exception 'ASSERTION_FAILURE: expected the no-permission message, got: %', sqlerrm;
    end if;
    raise notice 'OK: uninvolved MEMBER-B blocked from starting a timer on t4 (%)', sqlerrm;
end;
$$;

-- HEAD-A is t3's reviewer and Org A's HEAD, not its assignee — the
-- org-oversight override in is_task_assignee_side_actor() must still let
-- them use the timer, on their OWN attendance (attendance is per-actor,
-- not per-task).
set app.current_uid = '10000000-0000-0000-0000-000000000003'; -- HEAD-A
select clock_in();
select start_task_timer('70000000-0000-0000-0000-000000000003'); -- t3, MEMBER-A's task

do $$
declare
  n int;
begin
  select count(*) into n from task_time_entries
    where person_id = '20000000-0000-0000-0000-000000000003'
      and task_id = '70000000-0000-0000-0000-000000000003' and ended_at is null;
  if n <> 1 then
    raise exception 'ASSERTION_FAILURE: expected HEAD-A''s own running entry on t3, got %', n;
  end if;
  raise notice 'OK: HEAD-A (org oversight, not assignee) started a timer on t3';
end;
$$;

select pause_task_timer();
select clock_out();

-- ADMIN is a global override too, and likewise clocks in on their own
-- attendance, unrelated to Org A/B.
set app.current_uid = '10000000-0000-0000-0000-000000000001'; -- ADMIN
select clock_in();
select start_task_timer('70000000-0000-0000-0000-000000000003'); -- t3, not ADMIN's task or org

do $$
declare
  n int;
begin
  select count(*) into n from task_time_entries
    where person_id = '20000000-0000-0000-0000-000000000001'
      and task_id = '70000000-0000-0000-0000-000000000003' and ended_at is null;
  if n <> 1 then
    raise exception 'ASSERTION_FAILURE: expected ADMIN''s own running entry on t3, got %', n;
  end if;
  raise notice 'OK: ADMIN (global override) started a timer on t3';
end;
$$;

select pause_task_timer();
select clock_out();

-- ===========================================================================
-- 5. Cleanup: MEMBER-A clocks out (also exercises clock_out()'s own
--    auto-close of any still-active timer/break, per 0008_time_tracking.sql).
-- ===========================================================================

set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A
select clock_out();

do $$
declare
  n int;
begin
  select count(*) into n from attendance_sessions
    where person_id = '20000000-0000-0000-0000-000000000005' and clock_out_at is null;
  if n <> 0 then
    raise exception 'ASSERTION_FAILURE: expected MEMBER-A fully clocked out, got % open sessions', n;
  end if;
  raise notice 'OK: MEMBER-A clocked out cleanly at the end of the timer flow';
end;
$$;

reset app.current_uid;
select 'ALL TIMER FLOW CHECKS PASSED' as result;
