-- WorkBoard 2.0 — live capacity time snapshot.
--
-- Capacity screens need one scoped view of:
--   * when each person Clocked In
--   * whether they are currently on break
--   * which task timer is currently running
--   * accumulated closed time on that same task, so a resumed timer continues
--     from the previous total instead of appearing to restart from zero.
--
-- Scope follows existing time RLS semantics: self, ADMIN, EXECUTIVE, or a
-- HEAD who actively oversees the person through the appointment hierarchy.

create function capacity_time_snapshot()
returns table (
  person_id uuid,
  attendance_session_id uuid,
  clock_in_at timestamptz,
  is_on_break boolean,
  break_started_at timestamptz,
  active_task_id uuid,
  active_task_started_at timestamptz,
  active_task_accumulated_seconds bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as person_id,
    attendance.id as attendance_session_id,
    attendance.clock_in_at,
    (active_break.id is not null) as is_on_break,
    active_break.break_start_at as break_started_at,
    active_timer.task_id as active_task_id,
    active_timer.started_at as active_task_started_at,
    coalesce(prior_time.accumulated_seconds, 0)::bigint
      as active_task_accumulated_seconds
  from people p
  left join lateral (
    select s.id, s.clock_in_at
    from attendance_sessions s
    where s.person_id = p.id
      and s.clock_out_at is null
    limit 1
  ) attendance on true
  left join lateral (
    select b.id, b.break_start_at
    from attendance_breaks b
    where b.attendance_session_id = attendance.id
      and b.break_end_at is null
    limit 1
  ) active_break on true
  left join lateral (
    select t.task_id, t.started_at
    from task_time_entries t
    where t.person_id = p.id
      and t.ended_at is null
    limit 1
  ) active_timer on true
  left join lateral (
    select
      floor(
        coalesce(
          sum(extract(epoch from (t.ended_at - t.started_at))),
          0
        )
      )::bigint as accumulated_seconds
    from task_time_entries t
    where t.person_id = p.id
      and t.task_id = active_timer.task_id
      and t.ended_at is not null
  ) prior_time on true
  where
    p.id = current_person_id()
    or is_admin()
    or is_executive()
    or is_head_over_person(p.id);
$$;

grant execute on function capacity_time_snapshot() to authenticated;
