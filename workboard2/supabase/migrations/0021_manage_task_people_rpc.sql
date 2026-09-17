-- WorkBoard 2.0 — atomic task people management.
--
-- Replaces the management UI's multi-roundtrip sequence (fetch task, fetch
-- project, check each person's org, then update) with one locked, validated
-- database operation.

create function manage_task_people(
  p_task_id uuid,
  p_assignee_person_id uuid,
  p_reviewer_person_id uuid default null,
  p_approver_person_id uuid default null
)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  task_row tasks;
  project_org_id uuid;
  updated_task tasks;
begin
  if current_person_id() is null then
    raise exception 'ต้องเข้าสู่ระบบ';
  end if;

  select * into task_row
  from tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'ไม่พบงานนี้';
  end if;

  select organization_id into project_org_id
  from projects
  where id = task_row.project_id;

  if not (
    is_admin()
    or has_role_in_organization('HEAD', project_org_id)
  ) then
    raise exception 'ไม่มีสิทธิ์จัดการงานขององค์กรนี้';
  end if;

  if p_assignee_person_id is null then
    raise exception 'ต้องระบุผู้รับผิดชอบ';
  end if;

  if not exists (
    select 1
    from person_organization_ids(p_assignee_person_id) org_id
    where org_id = project_org_id
  ) then
    raise exception 'ผู้รับผิดชอบต้องอยู่ในองค์กรเดียวกับโครงการ';
  end if;

  if p_reviewer_person_id is not null and not exists (
    select 1
    from person_organization_ids(p_reviewer_person_id) org_id
    where org_id = project_org_id
  ) then
    raise exception 'ผู้ตรวจต้องอยู่ในองค์กรเดียวกับโครงการ';
  end if;

  if p_approver_person_id is not null and not exists (
    select 1
    from person_organization_ids(p_approver_person_id) org_id
    where org_id = project_org_id
  ) then
    raise exception 'ผู้อนุมัติต้องอยู่ในองค์กรเดียวกับโครงการ';
  end if;

  update tasks
  set
    assignee_person_id = p_assignee_person_id,
    reviewer_person_id = p_reviewer_person_id,
    approver_person_id = p_approver_person_id
  where id = p_task_id
  returning * into updated_task;

  return updated_task;
end;
$$;

grant execute on function manage_task_people(uuid, uuid, uuid, uuid) to authenticated;
