-- WorkBoard 2.0 — manual task permission hardening.
--
-- Members may add their own work, but reviewer/approver assignment is a
-- management responsibility. A direct RPC caller must not be able to bypass
-- the UI and nominate reviewer/approver accounts.

create or replace function create_manual_task(
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

  if not actor_is_manager then
    if assignee_id <> actor_id then
      raise exception 'สมาชิกเพิ่มงานให้ตนเองเท่านั้น';
    end if;

    if p_reviewer_person_id is not null or p_approver_person_id is not null then
      raise exception 'ผู้ตรวจและผู้อนุมัติต้องกำหนดโดยหัวหน้าฝ่าย';
    end if;
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
