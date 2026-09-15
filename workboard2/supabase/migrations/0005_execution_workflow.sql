-- WorkBoard 2.0 — Milestone 3: Execution
-- Submissions, comments, and safe workflow-transition RPC functions.
-- Additive only: does not modify 0001-0004.
--
-- Design: no role is ever granted a broad UPDATE on `tasks` beyond the
-- ADMIN/org-HEAD "head write" policy from 0003. A MEMBER moves their own
-- task through the workflow exclusively via the RPC functions below, each
-- of which checks the actor and the current status before doing anything,
-- inside a `SELECT ... FOR UPDATE` to serialize concurrent attempts.

-- ---------------------------------------------------------------------------
-- Submissions — message/link (file_path reserved for future Storage
-- support), versioned per task.
-- ---------------------------------------------------------------------------
create table task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  version integer not null,
  message text,
  link text,
  file_path text,
  submitted_by_person_id uuid not null references people (id) on delete restrict,
  submitted_at timestamptz not null default now(),
  constraint task_submissions_has_content check (
    message is not null or link is not null or file_path is not null
  ),
  unique (task_id, version)
);

create index task_submissions_task_id_idx on task_submissions (task_id);

-- ---------------------------------------------------------------------------
-- Comments — basic question flag and a plain array of mentioned person ids
-- (mention detection/formatting is an app-layer concern; this just records
-- who was tagged).
-- ---------------------------------------------------------------------------
create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  author_person_id uuid not null references people (id) on delete restrict,
  body text not null,
  is_question boolean not null default false,
  mentioned_person_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index task_comments_task_id_idx on task_comments (task_id);

create trigger set_updated_at before update on task_comments
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table task_submissions enable row level security;
alter table task_comments enable row level security;

create policy "scoped read" on task_submissions for select using (can_view_task(task_id));
-- No insert/update/delete policy for any role: rows are only ever created
-- by submit_task()/resubmit_task() below (SECURITY DEFINER, bypasses RLS).

create policy "scoped read" on task_comments for select using (can_view_task(task_id));
create policy "commenters insert" on task_comments for insert
  with check (can_view_task(task_id) and author_person_id = current_person_id());
create policy "author update" on task_comments for update
  using (author_person_id = current_person_id() or is_admin())
  with check (author_person_id = current_person_id() or is_admin());
create policy "author delete" on task_comments for delete
  using (author_person_id = current_person_id() or is_admin());

-- ---------------------------------------------------------------------------
-- Authorization helpers for workflow RPCs
-- ---------------------------------------------------------------------------
-- Assignee-side: the person doing the work (acknowledge/start/submit/
-- resubmit/complete), or an org-HEAD/ADMIN override.
create function is_task_assignee_side_actor(check_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    is_admin()
    or exists (
      select 1 from tasks t
      where t.id = check_task_id
        and (
          t.assignee_person_id = current_person_id()
          or has_role_in_organization('HEAD', task_organization_id(t.id))
        )
    );
$$;

-- Holder-side: whoever currently holds the task (begin_review/
-- request_revision/approve), or an org-HEAD/ADMIN override.
create function is_task_holder_side_actor(check_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    is_admin()
    or exists (
      select 1 from tasks t
      where t.id = check_task_id
        and (
          t.current_holder_person_id = current_person_id()
          or has_role_in_organization('HEAD', task_organization_id(t.id))
        )
    );
$$;

-- ---------------------------------------------------------------------------
-- Workflow RPCs
-- ---------------------------------------------------------------------------
create function acknowledge_task(p_task_id uuid)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  task_row tasks;
begin
  select * into task_row from tasks where id = p_task_id for update;
  if not found then
    raise exception 'ไม่พบงานนี้';
  end if;
  if not is_task_assignee_side_actor(p_task_id) then
    raise exception 'ไม่มีสิทธิ์ดำเนินการนี้';
  end if;
  if task_row.status <> 'ASSIGNED' then
    raise exception 'สถานะงานปัจจุบันไม่รองรับการรับทราบงาน';
  end if;

  update tasks set status = 'ACKNOWLEDGED' where id = p_task_id;
  return (select t from tasks t where t.id = p_task_id);
end;
$$;

create function start_task(p_task_id uuid)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  task_row tasks;
begin
  select * into task_row from tasks where id = p_task_id for update;
  if not found then
    raise exception 'ไม่พบงานนี้';
  end if;
  if not is_task_assignee_side_actor(p_task_id) then
    raise exception 'ไม่มีสิทธิ์ดำเนินการนี้';
  end if;
  if task_row.status <> 'ACKNOWLEDGED' then
    raise exception 'สถานะงานปัจจุบันไม่รองรับการเริ่มทำงาน';
  end if;

  update tasks set status = 'IN_PROGRESS' where id = p_task_id;
  return (select t from tasks t where t.id = p_task_id);
end;
$$;

create function submit_task(p_task_id uuid, p_message text default null, p_link text default null)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  task_row tasks;
  next_version integer;
  clean_message text := nullif(trim(p_message), '');
  clean_link text := nullif(trim(p_link), '');
begin
  select * into task_row from tasks where id = p_task_id for update;
  if not found then
    raise exception 'ไม่พบงานนี้';
  end if;
  if not is_task_assignee_side_actor(p_task_id) then
    raise exception 'ไม่มีสิทธิ์ดำเนินการนี้';
  end if;
  if task_row.status <> 'IN_PROGRESS' then
    raise exception 'สถานะงานปัจจุบันไม่รองรับการส่งงาน';
  end if;
  if clean_message is null and clean_link is null then
    raise exception 'ต้องระบุข้อความหรือลิงก์ผลงานอย่างน้อยหนึ่งอย่าง';
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from task_submissions where task_id = p_task_id;

  insert into task_submissions (task_id, version, message, link, submitted_by_person_id)
  values (p_task_id, next_version, clean_message, clean_link, current_person_id());

  update tasks set status = 'SUBMITTED' where id = p_task_id;
  return (select t from tasks t where t.id = p_task_id);
end;
$$;

create function begin_review(p_task_id uuid)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  task_row tasks;
begin
  select * into task_row from tasks where id = p_task_id for update;
  if not found then
    raise exception 'ไม่พบงานนี้';
  end if;
  if not is_task_holder_side_actor(p_task_id) then
    raise exception 'ไม่มีสิทธิ์ดำเนินการนี้';
  end if;
  if task_row.status not in ('SUBMITTED', 'RESUBMITTED') then
    raise exception 'สถานะงานปัจจุบันไม่รองรับการเริ่มตรวจงาน';
  end if;

  update tasks set status = 'IN_REVIEW' where id = p_task_id;
  return (select t from tasks t where t.id = p_task_id);
end;
$$;

create function request_revision(p_task_id uuid, p_note text default null)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  task_row tasks;
  clean_note text := nullif(trim(p_note), '');
begin
  select * into task_row from tasks where id = p_task_id for update;
  if not found then
    raise exception 'ไม่พบงานนี้';
  end if;
  if not is_task_holder_side_actor(p_task_id) then
    raise exception 'ไม่มีสิทธิ์ดำเนินการนี้';
  end if;
  if task_row.status <> 'IN_REVIEW' then
    raise exception 'สถานะงานปัจจุบันไม่รองรับการขอแก้ไข';
  end if;

  update tasks set status = 'REVISION_REQUIRED' where id = p_task_id;

  if clean_note is not null then
    insert into task_comments (task_id, author_person_id, body)
    values (p_task_id, current_person_id(), clean_note);
  end if;

  return (select t from tasks t where t.id = p_task_id);
end;
$$;

create function resubmit_task(p_task_id uuid, p_message text default null, p_link text default null)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  task_row tasks;
  next_version integer;
  clean_message text := nullif(trim(p_message), '');
  clean_link text := nullif(trim(p_link), '');
begin
  select * into task_row from tasks where id = p_task_id for update;
  if not found then
    raise exception 'ไม่พบงานนี้';
  end if;
  if not is_task_assignee_side_actor(p_task_id) then
    raise exception 'ไม่มีสิทธิ์ดำเนินการนี้';
  end if;
  if task_row.status <> 'REVISION_REQUIRED' then
    raise exception 'สถานะงานปัจจุบันไม่รองรับการส่งงานใหม่';
  end if;
  if clean_message is null and clean_link is null then
    raise exception 'ต้องระบุข้อความหรือลิงก์ผลงานอย่างน้อยหนึ่งอย่าง';
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from task_submissions where task_id = p_task_id;

  insert into task_submissions (task_id, version, message, link, submitted_by_person_id)
  values (p_task_id, next_version, clean_message, clean_link, current_person_id());

  update tasks set status = 'RESUBMITTED' where id = p_task_id;
  return (select t from tasks t where t.id = p_task_id);
end;
$$;

create function approve_task(p_task_id uuid)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  task_row tasks;
begin
  select * into task_row from tasks where id = p_task_id for update;
  if not found then
    raise exception 'ไม่พบงานนี้';
  end if;
  if not is_task_holder_side_actor(p_task_id) then
    raise exception 'ไม่มีสิทธิ์ดำเนินการนี้';
  end if;
  if task_row.status <> 'IN_REVIEW' then
    raise exception 'สถานะงานปัจจุบันไม่รองรับการอนุมัติ';
  end if;

  update tasks set status = 'APPROVED' where id = p_task_id;
  return (select t from tasks t where t.id = p_task_id);
end;
$$;

create function complete_task(p_task_id uuid)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  task_row tasks;
begin
  select * into task_row from tasks where id = p_task_id for update;
  if not found then
    raise exception 'ไม่พบงานนี้';
  end if;
  if not is_task_assignee_side_actor(p_task_id) then
    raise exception 'ไม่มีสิทธิ์ดำเนินการนี้';
  end if;
  if task_row.status <> 'APPROVED' then
    raise exception 'สถานะงานปัจจุบันไม่รองรับการปิดงาน';
  end if;

  update tasks set status = 'COMPLETED' where id = p_task_id;
  return (select t from tasks t where t.id = p_task_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Rollback (manual, additive-only):
--
-- drop function if exists complete_task(uuid);
-- drop function if exists approve_task(uuid);
-- drop function if exists resubmit_task(uuid, text, text);
-- drop function if exists request_revision(uuid, text);
-- drop function if exists begin_review(uuid);
-- drop function if exists submit_task(uuid, text, text);
-- drop function if exists start_task(uuid);
-- drop function if exists acknowledge_task(uuid);
-- drop function if exists is_task_holder_side_actor(uuid);
-- drop function if exists is_task_assignee_side_actor(uuid);
-- drop policy if exists "author delete" on task_comments;
-- drop policy if exists "author update" on task_comments;
-- drop policy if exists "commenters insert" on task_comments;
-- drop policy if exists "scoped read" on task_comments;
-- drop policy if exists "scoped read" on task_submissions;
-- drop table if exists task_comments;
-- drop table if exists task_submissions;
