-- WorkBoard 2.0 — atomic project creation with optional Playbook.
--
-- Without this RPC, creating a project and then applying a Playbook required
-- two separate requests. If the second request failed, the user was left with
-- a half-created project. This RPC performs both steps in one transaction.

create function create_project_with_optional_playbook(
  p_organization_id uuid,
  p_name text,
  p_description text default null,
  p_start_date date default null,
  p_target_date date default null,
  p_playbook_id uuid default null
)
returns projects
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  created_project projects;
begin
  if actor_id is null then
    raise exception 'ต้องเข้าสู่ระบบ';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'กรุณาใส่ชื่อโครงการ';
  end if;

  if not (
    is_admin()
    or has_role_in_organization('HEAD', p_organization_id)
  ) then
    raise exception 'ไม่มีสิทธิ์สร้างโครงการในองค์กรนี้';
  end if;

  if p_playbook_id is not null and not exists (
    select 1 from playbooks where id = p_playbook_id
  ) then
    raise exception 'ไม่พบร่างมาตรฐานที่เลือก';
  end if;

  insert into projects (
    organization_id,
    owner_person_id,
    name,
    description,
    start_date,
    target_date
  ) values (
    p_organization_id,
    actor_id,
    trim(p_name),
    nullif(trim(coalesce(p_description, '')), ''),
    p_start_date,
    p_target_date
  )
  returning * into created_project;

  if p_playbook_id is not null then
    perform apply_playbook_to_project(created_project.id, p_playbook_id);
  end if;

  return created_project;
end;
$$;

grant execute on function create_project_with_optional_playbook(
  uuid, text, text, date, date, uuid
) to authenticated;

-- Rollback:
-- drop function if exists create_project_with_optional_playbook(uuid, text, text, date, date, uuid);
