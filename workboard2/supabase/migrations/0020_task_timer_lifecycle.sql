-- WorkBoard 2.0 — keep task timer lifecycle consistent with task lifecycle.
--
-- A running timer must never survive:
--   * the task leaving a working status (submit/review/etc.), or
--   * reassignment to another person.
-- Without this, elapsed time could continue accumulating while the task is
-- already waiting for review or belongs to somebody else.

create function stop_task_timer_on_task_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.assignee_person_id is distinct from old.assignee_person_id
    or (
      old.status in ('IN_PROGRESS', 'REVISION_REQUIRED')
      and new.status not in ('IN_PROGRESS', 'REVISION_REQUIRED')
    )
  ) then
    update task_time_entries
    set ended_at = now()
    where task_id = old.id
      and ended_at is null;
  end if;

  return new;
end;
$$;

create trigger tasks_stop_active_timer
  before update of assignee_person_id, status on tasks
  for each row execute function stop_task_timer_on_task_transition();
