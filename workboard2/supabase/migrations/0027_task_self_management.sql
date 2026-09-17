-- WorkBoard 2.0 — task self-management.
--
-- Members need to correct priority and manually-entered work after creation.
-- Preserve auditability: "delete" from active work is implemented as CANCELLED,
-- not a physical DELETE, so history/time/submissions are never silently lost.

create function update_task_priority(
  p_task_id uuid,
  p_is_important boolean,
  p_is_urgent boolean
)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  task_row tasks;
  updated_task tasks;
begin
  select * into task_row
  from tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'ไม่พบงานนี้';
  end if;

  if task_row.status in ('APPROVED', 'COMPLETED', 'CANCELLED') then
    raise exception 'งานที่ปิดแล้วไม่สามารถเปลี่ยน Priority ได้';
  end if;

  if not (
    task_row.assignee_person_id = actor_id
    or is_admin()
    or has_role_in_organization('HEAD', task_organization_id(p_task_id))
  ) then
    raise exception 'ผู้รับผิดชอบหรือหัวหน้าฝ่ายเท่านั้นที่เปลี่ยน Priority ได้';
  end if;

  update tasks
  set
    is_important = p_is_important,
    is_urgent = p_is_urgent
  where id = p_task_id
  returning * into updated_task;

  return updated_task;
end;
$$;

create function update_manual_task_details(
  p_task_id uuid,
  p_title text,
  p_description text default null,
  p_deadline timestamptz default null,
  p_estimated_hours numeric default null,
  p_is_important boolean default true,
  p_is_urgent boolean default false
)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  task_row tasks;
  updated_task tasks;
begin
  select * into task_row
  from tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'ไม่พบงานนี้';
  end if;

  if task_row.source is distinct from 'MANUAL' then
    raise exception 'แก้รายละเอียดได้เฉพาะงานที่เพิ่มเอง งานจากร่างมาตรฐานให้แก้ผ่านหัวหน้าฝ่าย';
  end if;

  if task_row.status in ('APPROVED', 'COMPLETED', 'CANCELLED') then
    raise exception 'งานที่ปิดแล้วไม่สามารถแก้ไขได้';
  end if;

  if not (
    task_row.assignee_person_id = actor_id
    or is_admin()
    or has_role_in_organization('HEAD', task_organization_id(p_task_id))
  ) then
    raise exception 'ไม่มีสิทธิ์แก้ไขงานนี้';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception 'กรุณาใส่ชื่องาน';
  end if;

  if p_estimated_hours is not null and p_estimated_hours <= 0 then
    raise exception 'ชั่วโมงโดยประมาณต้องมากกว่า 0';
  end if;

  update tasks
  set
    title = trim(p_title),
    description = nullif(trim(coalesce(p_description, '')), ''),
    deadline = p_deadline,
    estimated_hours = p_estimated_hours,
    is_important = p_is_important,
    is_urgent = p_is_urgent
  where id = p_task_id
  returning * into updated_task;

  return updated_task;
end;
$$;

create function cancel_task_from_active_work(
  p_task_id uuid
)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  task_row tasks;
  updated_task tasks;
begin
  select * into task_row
  from tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'ไม่พบงานนี้';
  end if;

  if task_row.status in ('APPROVED', 'COMPLETED', 'CANCELLED') then
    raise exception 'งานนี้ปิดอยู่แล้ว';
  end if;

  if not (
    is_admin()
    or has_role_in_organization('HEAD', task_organization_id(p_task_id))
    or (
      task_row.source = 'MANUAL'
      and task_row.assignee_person_id = actor_id
    )
  ) then
    raise exception 'สมาชิกยกเลิกได้เฉพาะงานที่เพิ่มเองของตนเอง';
  end if;

  update tasks
  set status = 'CANCELLED'
  where id = p_task_id
  returning * into updated_task;

  return updated_task;
end;
$$;

grant execute on function update_task_priority(uuid, boolean, boolean) to authenticated;
grant execute on function update_manual_task_details(
  uuid, text, text, timestamptz, numeric, boolean, boolean
) to authenticated;
grant execute on function cancel_task_from_active_work(uuid) to authenticated;
