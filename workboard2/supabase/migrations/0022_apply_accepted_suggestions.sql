-- WorkBoard 2.0 — accepted suggestion application.
--
-- Responding to a suggestion remains a separate decision from mutating the
-- canonical WorkBoard task. After accepting, the task owner explicitly
-- applies it. This preserves the original "proposal first" design while
-- removing the dead-end where an accepted suggestion had no effect.

alter table suggestions
  add column applied_at timestamptz;

create function apply_accepted_suggestion(p_suggestion_id uuid)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  suggestion_row suggestions;
  task_row tasks;
  updated_task tasks;
begin
  if actor_id is null then
    raise exception 'ต้องเข้าสู่ระบบ';
  end if;

  select * into suggestion_row
  from suggestions
  where id = p_suggestion_id
  for update;

  if not found then
    raise exception 'ไม่พบคำแนะนำนี้';
  end if;

  if suggestion_row.status <> 'accepted' then
    raise exception 'ต้องรับคำแนะนำก่อนนำไปใช้';
  end if;

  if suggestion_row.applied_at is not null then
    raise exception 'คำแนะนำนี้ถูกนำไปใช้แล้ว';
  end if;

  select * into task_row
  from tasks
  where id = suggestion_row.task_id
  for update;

  if not found then
    raise exception 'ไม่พบงานนี้';
  end if;

  if task_row.assignee_person_id is distinct from actor_id then
    raise exception 'ผู้รับผิดชอบงานเท่านั้นที่นำคำแนะนำไปใช้ได้';
  end if;

  update tasks
  set
    is_important = suggestion_row.suggested_is_important,
    is_urgent = suggestion_row.suggested_is_urgent
  where id = task_row.id
  returning * into updated_task;

  update suggestions
  set applied_at = now()
  where id = suggestion_row.id;

  return updated_task;
end;
$$;

grant execute on function apply_accepted_suggestion(uuid) to authenticated;
