-- WorkBoard 2.0 — Local/staging test seed.
--
-- DEV/TEST DATA ONLY. Never run this against a database with real users —
-- it inserts fake auth.users rows with a shared, publicly-known password
-- ("Password123!") purely for local `supabase start` / staging QA.
--
-- Loaded automatically by `supabase db reset` (see [db.seed] in
-- supabase/config.toml). To load manually against a running instance:
--   psql "$DATABASE_URL" -f supabase/seed.sql
--
-- Scenario: two organizations (A, B) under one network, one HEAD and one
-- MEMBER per org, plus a global ADMIN and EXECUTIVE — enough to exercise
-- cross-org RLS, the reviewer/approver split, workflow transitions, and
-- time tracking end to end. See docs/testing-checklist.md.

-- ---------------------------------------------------------------------------
-- Auth users (local GoTrue). Password for all: Password123!
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@test.local', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'executive@test.local', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'head-a@test.local', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'head-b@test.local', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'member-a@test.local', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'member-b@test.local', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Org structure: 1 network, Organization A / B, 1 unit + 1 position each.
-- ---------------------------------------------------------------------------
insert into networks (id, name) values
  ('30000000-0000-0000-0000-000000000001', 'เครือข่ายทดสอบ')
on conflict (id) do nothing;

insert into organizations (id, network_id, name) values
  ('30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'องค์กร A'),
  ('30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'องค์กร B')
on conflict (id) do nothing;

insert into organization_units (id, organization_id, name) values
  ('30000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', 'หน่วยงาน A'),
  ('30000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000003', 'หน่วยงาน B')
on conflict (id) do nothing;

insert into positions (id, unit_id, title) values
  ('30000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000004', 'เจ้าหน้าที่ องค์กร A'),
  ('30000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000005', 'เจ้าหน้าที่ องค์กร B')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- People, linked to auth.users, plus roles and active appointments (the
-- appointments are what is_head_over_person()/RLS scope actually reads).
-- ---------------------------------------------------------------------------
insert into people (id, auth_user_id, full_name, email) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'แอดมิน ระบบ', 'admin@test.local'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'ประธาน ทดสอบ', 'executive@test.local'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'หัวหน้า องค์กรเอ', 'head-a@test.local'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'หัวหน้า องค์กรบี', 'head-b@test.local'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', 'สมาชิก องค์กรเอ', 'member-a@test.local'),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000006', 'สมาชิก องค์กรบี', 'member-b@test.local')
on conflict (id) do nothing;

insert into person_roles (person_id, role, organization_id) values
  ('20000000-0000-0000-0000-000000000001', 'ADMIN', null),
  ('20000000-0000-0000-0000-000000000002', 'EXECUTIVE', null),
  ('20000000-0000-0000-0000-000000000003', 'HEAD', '30000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000004', 'HEAD', '30000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000005', 'MEMBER', '30000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000006', 'MEMBER', '30000000-0000-0000-0000-000000000003')
on conflict do nothing;

insert into appointments (person_id, position_id) values
  ('20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000006'),
  ('20000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000007'),
  ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000006'),
  ('20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000007')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Teams (one working team per org, membership matching the appointments).
-- ---------------------------------------------------------------------------
insert into teams (id, network_id, owner_organization_id, team_type, name) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'WORKING', 'ทีมองค์กร A'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'WORKING', 'ทีมองค์กร B')
on conflict (id) do nothing;

insert into team_memberships (team_id, person_id, role_in_team) values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'หัวหน้าทีม'),
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005', 'สมาชิก'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000004', 'หัวหน้าทีม'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000006', 'สมาชิก')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Projects (one per org) + a workstream each.
-- ---------------------------------------------------------------------------
insert into projects (id, organization_id, owner_person_id, name, description, status, target_date) values
  ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 'โครงการทดสอบ A', 'โครงการสำหรับทดสอบระบบในองค์กร A', 'ACTIVE', current_date + interval '30 days'),
  ('50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004', 'โครงการทดสอบ B', 'โครงการสำหรับทดสอบระบบในองค์กร B', 'ACTIVE', current_date + interval '30 days')
on conflict (id) do nothing;

insert into team_projects (team_id, project_id) values
  ('40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002')
on conflict do nothing;

insert into workstreams (id, project_id, name, owner_person_id, sort_order) values
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'งานทดสอบ', '20000000-0000-0000-0000-000000000003', 1),
  ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 'งานทดสอบ', '20000000-0000-0000-0000-000000000004', 1)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Tasks.
-- t1: the primary end-to-end flow test — reviewer (HEAD-A) and approver
--     (EXECUTIVE) both set, so it exercises the Milestone 3.1 fix
--     (reviewer must not be able to approve once an approver is set).
-- t2: Org B, no approver — exercises the direct-approve path (case C).
-- t3: P1 + overdue, for dashboard "ต้องให้ความสนใจ" / "เกินกำหนด" checks.
-- t4: blocked, for dashboard "ติดขัด" checks.
-- ---------------------------------------------------------------------------
insert into tasks (
  id, project_id, workstream_id, title, description,
  assignee_person_id, reviewer_person_id, approver_person_id,
  deadline, is_important, is_urgent
) values
  (
    '70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001',
    'งานทดสอบ Flow ครบวงจร', 'ใช้ทดสอบ Assigned -> ... -> Completed',
    '20000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002',
    now() + interval '7 days', true, false
  ),
  (
    '70000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002',
    'งานทดสอบไม่มีผู้อนุมัติ', 'ใช้ทดสอบ approve ตรงจาก IN_REVIEW เมื่อไม่มี approver',
    '20000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000004', null,
    now() + interval '7 days', true, false
  ),
  (
    '70000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001',
    'งานด่วนเกินกำหนด', 'P1 และเกินกำหนดแล้ว สำหรับทดสอบ dashboard',
    '20000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', null,
    now() - interval '2 days', true, true
  ),
  (
    '70000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000001', null,
    'งานติดขัด', 'ใช้ทดสอบ dashboard สถานะติดขัด',
    '20000000-0000-0000-0000-000000000005', null, null,
    now() + interval '14 days', true, false
  )
on conflict (id) do nothing;

update tasks set is_blocked = true, blocked_reason = 'รอข้อมูลจากหน่วยงานภายนอก'
where id = '70000000-0000-0000-0000-000000000004';
