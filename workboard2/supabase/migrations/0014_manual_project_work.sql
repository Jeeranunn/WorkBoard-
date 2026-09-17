-- WorkBoard 2.0 — optional playbook + manual work entry.
--
-- Product rule:
--   * A project may use a standard Playbook, or have no predefined workstream/task draft at all.
--   * HEAD/ADMIN may add and assign manual work inside projects they manage.
--   * A MEMBER may add manual work for themself inside a project belonging to an
--     organization where they have an active appointment.
--   * Manual work is marked work_origin='ADDED' and source='MANUAL'.
--
-- Project containers are visible to active organization members so a member
-- can enter their own work even when the project starts empty. Task visibility
-- remains narrow: members still do not gain access to sibling tasks they are
-- not involved in.

create or replace function can_view_project(check_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    is_admin()
    or is_executive()
    or has_role_in_organization('HEAD', project_organization_id(check_project_id))
    or exists (
      select 1
      from person_organization_ids(current_person_id()) org_id
      where org_id = project_organization_id(check_project_id)
    )
    or exists (
      select 1 from tasks t
      where t.project_id = check_project_id
        and (
          t.assignee_person_id = current_person_id()
          or t.reviewer_person_id = current_person_id()
          or t.approver_person_id = current_person_id()
          or exists (
            select 1 from task_collaborators tc
            where tc.task_id = t.id and tc.person_id = current_person_id()
          )
        )
    );
$$;

create function create_manual_task(
  p_project_id uuid,
  p_title text,
  p_description text default null,
  p_workstream_id uuid default null,
  p_assignee_person_id uuid default null,
  p_reviewer_person_id uuid default null,
  p_approver_person_id uuid default null,
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
  project_row projects;
  assignee_id uuid;
  created_task tasks;
  actor_is_manager boolean;
begin
  if actor_id is null then
    raise exception 'ต้องเข้าสู่ระบบ';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception 'กรุณาใส่ชื่องาน';
  end if;

  select * into project_row
  from projects
  where id = p_project_id and is_active = true;

  if not found then
    raise exception 'ไม่พบโครงการนี้';
  end if;

  actor_is_manager :=
    is_admin()
    or has_role_in_organization('HEAD', project_row.organization_id);

  if not actor_is_manager and not exists (
    select 1
    from person_organization_ids(actor_id) org_id
    where org_id = project_row.organization_id
  ) then
    raise exception 'คุณไม่ได้อยู่ในองค์กรของโครงการนี้';
  end if;

  assignee_id := coalesce(p_assignee_person_id, actor_id);

  -- Members may only create work assigned to themselves. Managers may assign
  -- to another active person in the same organization.
  if not actor_is_manager and assignee_id <> actor_id then
    raise exception 'สมาชิกเพิ่มงานให้ตนเองเท่านั้น';
  end if;

  if not exists (
    select 1
    from person_organization_ids(assignee_id) org_id
    where org_id = project_row.organization_id
  ) then
    raise exception 'ผู้รับผิดชอบต้องอยู่ในองค์กรเดียวกับโครงการ';
  end if;

  if p_reviewer_person_id is not null and not exists (
    select 1
    from person_organization_ids(p_reviewer_person_id) org_id
    where org_id = project_row.organization_id
  ) then
    raise exception 'ผู้ตรวจต้องอยู่ในองค์กรเดียวกับโครงการ';
  end if;

  if p_approver_person_id is not null and not exists (
    select 1
    from person_organization_ids(p_approver_person_id) org_id
    where org_id = project_row.organization_id
  ) then
    raise exception 'ผู้อนุมัติต้องอยู่ในองค์กรเดียวกับโครงการ';
  end if;

  if p_workstream_id is not null and not exists (
    select 1 from workstreams
    where id = p_workstream_id
      and project_id = p_project_id
      and is_active = true
  ) then
    raise exception 'กลุ่มงานไม่อยู่ในโครงการนี้';
  end if;

  if p_estimated_hours is not null and p_estimated_hours <= 0 then
    raise exception 'ชั่วโมงโดยประมาณต้องมากกว่า 0';
  end if;

  insert into tasks (
    project_id,
    workstream_id,
    title,
    description,
    source,
    work_origin,
    assignee_person_id,
    reviewer_person_id,
    approver_person_id,
    deadline,
    estimated_hours,
    is_important,
    is_urgent,
    current_holder_person_id
  ) values (
    p_project_id,
    p_workstream_id,
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    'MANUAL',
    'ADDED',
    assignee_id,
    p_reviewer_person_id,
    p_approver_person_id,
    p_deadline,
    p_estimated_hours,
    p_is_important,
    p_is_urgent,
    assignee_id
  )
  returning * into created_task;

  return created_task;
end;
$$;

grant execute on function create_manual_task(
  uuid, text, text, uuid, uuid, uuid, uuid, timestamptz, numeric, boolean, boolean
) to authenticated;

-- Rollback:
-- drop function if exists create_manual_task(uuid, text, text, uuid, uuid, uuid, uuid, timestamptz, numeric, boolean, boolean);
-- restore can_view_project() from 0003_work_core.sql if organization-member
-- project-container visibility is no longer desired.
