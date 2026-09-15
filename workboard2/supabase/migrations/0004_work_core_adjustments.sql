-- WorkBoard 2.0 — Milestone 2.1: Work Core Adjustments
--
-- Two small corrections found before starting Milestone 3. Additive only:
-- does not modify 0001/0002/0003 — the trigger functions are updated via
-- CREATE OR REPLACE rather than editing the files that created them.
--
-- 1. current_holder_person_id means "who must act next". At APPROVED /
--    COMPLETED / CANCELLED there is no next action, so it must be NULL
--    rather than pointing at a stale assignee.
-- 2. task_history did not log approver_person_id changes, only
--    reviewer_person_id — added for parity.

alter table tasks alter column current_holder_person_id drop not null;

create or replace function compute_task_current_holder()
returns trigger
language plpgsql
as $$
begin
  new.current_holder_person_id := case new.status
    when 'SUBMITTED' then coalesce(new.reviewer_person_id, new.approver_person_id, new.assignee_person_id)
    when 'IN_REVIEW' then coalesce(new.reviewer_person_id, new.approver_person_id, new.assignee_person_id)
    when 'RESUBMITTED' then coalesce(new.reviewer_person_id, new.approver_person_id, new.assignee_person_id)
    when 'APPROVED' then null
    when 'COMPLETED' then null
    when 'CANCELLED' then null
    else new.assignee_person_id
  end;
  return new;
end;
$$;

create or replace function log_task_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
begin
  actor_id := current_person_id();

  if new.status is distinct from old.status then
    insert into task_history (task_id, changed_by_person_id, field_name, old_value, new_value)
    values (new.id, actor_id, 'status', old.status::text, new.status::text);
  end if;

  if new.assignee_person_id is distinct from old.assignee_person_id then
    insert into task_history (task_id, changed_by_person_id, field_name, old_value, new_value)
    values (new.id, actor_id, 'assignee_person_id', old.assignee_person_id::text, new.assignee_person_id::text);
  end if;

  if new.reviewer_person_id is distinct from old.reviewer_person_id then
    insert into task_history (task_id, changed_by_person_id, field_name, old_value, new_value)
    values (new.id, actor_id, 'reviewer_person_id', old.reviewer_person_id::text, new.reviewer_person_id::text);
  end if;

  if new.approver_person_id is distinct from old.approver_person_id then
    insert into task_history (task_id, changed_by_person_id, field_name, old_value, new_value)
    values (new.id, actor_id, 'approver_person_id', old.approver_person_id::text, new.approver_person_id::text);
  end if;

  if new.deadline is distinct from old.deadline then
    insert into task_history (task_id, changed_by_person_id, field_name, old_value, new_value)
    values (new.id, actor_id, 'deadline', old.deadline::text, new.deadline::text);
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rollback (manual):
--
-- create or replace function log_task_changes() ... (restore 0003 version, drops approver_person_id block)
-- create or replace function compute_task_current_holder() ... (restore 0003 version, drops APPROVED/COMPLETED/CANCELLED -> null)
-- alter table tasks alter column current_holder_person_id set not null;
--   (only safe if no row currently has it null)
