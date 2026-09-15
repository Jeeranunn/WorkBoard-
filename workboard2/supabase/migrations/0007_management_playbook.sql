-- WorkBoard 2.0 — Milestone 4: Management (Playbook v0)
-- Executive/Team dashboards and Project Completeness are read-only queries
-- built in the app layer against existing tables (no new schema needed for
-- those). This migration adds only what Playbook v0 needs: template
-- tables, one seeded "activity/event" playbook, lineage columns so
-- instantiated work can be traced back to its template, and the RPC that
-- applies a playbook to a project. Additive only — 0001-0006 untouched.

-- ---------------------------------------------------------------------------
-- Playbook templates
-- ---------------------------------------------------------------------------
create table playbooks (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table playbook_workstreams (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references playbooks (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- tag/if_tag/then_tag are a minimal way to express CLAUDE.md's completeness
-- examples ("has a speaker task but no coordination task") without a full
-- rules engine: a playbook_task can carry a tag, and a conditional rule
-- says "if a project has an active task tagged if_tag, it must also have
-- one tagged then_tag". Evaluated in the app layer (Project Completeness).
create table playbook_tasks (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references playbooks (id) on delete cascade,
  playbook_workstream_id uuid references playbook_workstreams (id) on delete set null,
  title text not null,
  description text,
  deliverable text,
  completion_criteria text,
  requires_reviewer boolean not null default false,
  tag text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table playbook_conditional_rules (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references playbooks (id) on delete cascade,
  if_tag text not null,
  then_tag text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create trigger set_updated_at before update on playbooks
  for each row execute function set_updated_at();

alter table playbooks enable row level security;
alter table playbook_workstreams enable row level security;
alter table playbook_tasks enable row level security;
alter table playbook_conditional_rules enable row level security;

create policy "authenticated read" on playbooks for select using (auth.uid() is not null);
create policy "admin write" on playbooks for all using (is_admin()) with check (is_admin());

create policy "authenticated read" on playbook_workstreams for select using (auth.uid() is not null);
create policy "admin write" on playbook_workstreams for all using (is_admin()) with check (is_admin());

create policy "authenticated read" on playbook_tasks for select using (auth.uid() is not null);
create policy "admin write" on playbook_tasks for all using (is_admin()) with check (is_admin());

create policy "authenticated read" on playbook_conditional_rules for select using (auth.uid() is not null);
create policy "admin write" on playbook_conditional_rules for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Lineage: which playbook item a workstream/task was instantiated from.
-- Nullable — manually created work has no playbook origin.
-- ---------------------------------------------------------------------------
alter table workstreams add column source_playbook_workstream_id uuid
  references playbook_workstreams (id) on delete set null;
alter table tasks add column source_playbook_task_id uuid
  references playbook_tasks (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Seed: one v0 playbook for "กิจกรรม/งานอีเวนต์" using the standard
-- structure from CLAUDE.md (วางแผน/เอกสาร/ประสานงาน/ประชาสัมพันธ์/
-- การดำเนินงาน/การเงิน/รายงานผล/ถอดบทเรียน) plus the two example
-- conditional gaps (speaker-without-coordination,
-- announcement-without-review).
-- ---------------------------------------------------------------------------
insert into playbooks (id, key, name, description) values
  ('00000000-0000-0000-0001-000000000000', 'EVENT_ACTIVITY', 'กิจกรรม/งานอีเวนต์',
   'โครงสร้างงานมาตรฐานสำหรับกิจกรรม/งานอีเวนต์ ตามแนวทาง WorkBoard 2.0');

insert into playbook_workstreams (id, playbook_id, name, sort_order) values
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000000', 'วางแผน', 1),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000000', 'เอกสาร', 2),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000000', 'ประสานงาน', 3),
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0001-000000000000', 'ประชาสัมพันธ์', 4),
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0001-000000000000', 'การดำเนินงาน', 5),
  ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0001-000000000000', 'การเงิน', 6),
  ('00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0001-000000000000', 'รายงานผล', 7),
  ('00000000-0000-0000-0002-000000000008', '00000000-0000-0000-0001-000000000000', 'ถอดบทเรียน', 8);

insert into playbook_tasks
  (playbook_id, playbook_workstream_id, title, requires_reviewer, tag, sort_order)
values
  ('00000000-0000-0000-0001-000000000000', '00000000-0000-0000-0002-000000000001', 'กำหนดวัตถุประสงค์และขอบเขตกิจกรรม', false, null, 1),
  ('00000000-0000-0000-0001-000000000000', '00000000-0000-0000-0002-000000000001', 'จัดทำกำหนดการ (Timeline)', false, null, 2),

  ('00000000-0000-0000-0001-000000000000', '00000000-0000-0000-0002-000000000002', 'จัดทำเอกสารเสนอโครงการ/ขออนุมัติ', true, null, 1),

  ('00000000-0000-0000-0001-000000000000', '00000000-0000-0000-0002-000000000003', 'ประสานวิทยากร/ผู้ร่วมงาน', false, 'SPEAKER', 1),
  ('00000000-0000-0000-0001-000000000000', '00000000-0000-0000-0002-000000000003', 'ประสานงานสถานที่และอุปกรณ์', false, 'COORDINATION', 2),

  ('00000000-0000-0000-0001-000000000000', '00000000-0000-0000-0002-000000000004', 'จัดทำสื่อประชาสัมพันธ์', false, 'PR', 1),
  ('00000000-0000-0000-0001-000000000000', '00000000-0000-0000-0002-000000000004', 'ตรวจสอบสื่อประชาสัมพันธ์ก่อนเผยแพร่', true, 'PR_REVIEW', 2),

  ('00000000-0000-0000-0001-000000000000', '00000000-0000-0000-0002-000000000005', 'จัดเตรียมสถานที่และทดสอบระบบ', false, null, 1),
  ('00000000-0000-0000-0001-000000000000', '00000000-0000-0000-0002-000000000005', 'ควบคุมงานหน้างานวันจัดกิจกรรม', false, null, 2),

  ('00000000-0000-0000-0001-000000000000', '00000000-0000-0000-0002-000000000006', 'จัดทำงบประมาณและขออนุมัติ', true, null, 1),
  ('00000000-0000-0000-0001-000000000000', '00000000-0000-0000-0002-000000000006', 'สรุปค่าใช้จ่ายจริงหลังงาน', true, null, 2),

  ('00000000-0000-0000-0001-000000000000', '00000000-0000-0000-0002-000000000007', 'จัดทำรายงานสรุปผลกิจกรรม', true, null, 1),

  ('00000000-0000-0000-0001-000000000000', '00000000-0000-0000-0002-000000000008', 'ประชุมถอดบทเรียนหลังกิจกรรม', false, null, 1);

insert into playbook_conditional_rules (playbook_id, if_tag, then_tag, message) values
  ('00000000-0000-0000-0001-000000000000', 'SPEAKER', 'COORDINATION', 'มีวิทยากรแต่ยังไม่มีงานประสาน'),
  ('00000000-0000-0000-0001-000000000000', 'PR', 'PR_REVIEW', 'มีประชาสัมพันธ์แต่ยังไม่มีงานตรวจ');

-- ---------------------------------------------------------------------------
-- Apply a playbook to a project: idempotent (safe to call again — skips
-- workstreams/tasks already instantiated from the same template), scoped to
-- ADMIN or the project's org-HEAD. New tasks are assigned to the project
-- owner as a placeholder (the HEAD reassigns after applying) with no
-- reviewer set — a missing reviewer is exactly what Project Completeness
-- checks for, so requires_reviewer stays a hint the app surfaces rather
-- than an auto-filled (and often nonsensical, since it'd default to the
-- same person) value.
-- ---------------------------------------------------------------------------
create function apply_playbook_to_project(p_project_id uuid, p_playbook_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  project_row projects;
  ws record;
  pt record;
  new_workstream_id uuid;
  created_count integer := 0;
begin
  select * into project_row from projects where id = p_project_id for update;
  if not found then
    raise exception 'ไม่พบโครงการนี้';
  end if;
  if not (is_admin() or has_role_in_organization('HEAD', project_row.organization_id)) then
    raise exception 'ไม่มีสิทธิ์ดำเนินการนี้';
  end if;
  if not exists (select 1 from playbooks where id = p_playbook_id) then
    raise exception 'ไม่พบ Playbook นี้';
  end if;

  for ws in
    select * from playbook_workstreams where playbook_id = p_playbook_id order by sort_order
  loop
    select id into new_workstream_id from workstreams
      where project_id = p_project_id and source_playbook_workstream_id = ws.id;

    if new_workstream_id is null then
      insert into workstreams (project_id, name, sort_order, work_origin, source_playbook_workstream_id)
      values (p_project_id, ws.name, ws.sort_order, 'PLANNED', ws.id)
      returning id into new_workstream_id;
    end if;

    for pt in
      select * from playbook_tasks where playbook_workstream_id = ws.id order by sort_order
    loop
      if not exists (
        select 1 from tasks where project_id = p_project_id and source_playbook_task_id = pt.id
      ) then
        insert into tasks (
          project_id, workstream_id, title, description, deliverable, completion_criteria,
          work_origin, assignee_person_id, source_playbook_task_id
        ) values (
          p_project_id, new_workstream_id, pt.title, pt.description, pt.deliverable, pt.completion_criteria,
          'PLANNED', project_row.owner_person_id, pt.id
        );
        created_count := created_count + 1;
      end if;
    end loop;
  end loop;

  for pt in
    select * from playbook_tasks
    where playbook_id = p_playbook_id and playbook_workstream_id is null
    order by sort_order
  loop
    if not exists (
      select 1 from tasks where project_id = p_project_id and source_playbook_task_id = pt.id
    ) then
      insert into tasks (
        project_id, workstream_id, title, description, deliverable, completion_criteria,
        work_origin, assignee_person_id, source_playbook_task_id
      ) values (
        p_project_id, null, pt.title, pt.description, pt.deliverable, pt.completion_criteria,
        'PLANNED', project_row.owner_person_id, pt.id
      );
      created_count := created_count + 1;
    end if;
  end loop;

  return created_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rollback (manual, additive-only):
--
-- drop function if exists apply_playbook_to_project(uuid, uuid);
-- alter table tasks drop column if exists source_playbook_task_id;
-- alter table workstreams drop column if exists source_playbook_workstream_id;
-- delete from playbooks where key = 'EVENT_ACTIVITY'; -- cascades to workstreams/tasks/rules
-- drop table if exists playbook_conditional_rules;
-- drop table if exists playbook_tasks;
-- drop table if exists playbook_workstreams;
-- drop table if exists playbooks;
