-- WorkBoard 2.0 — Global Performance Audit hotfix: missing indexes.
--
-- Additive only, no RLS/behavior change. Found by tracing every app query
-- against `supabase/migrations/*.sql`'s existing `create index` statements:
--
-- - tasks.deadline had NO index at all, despite being filtered
--   (`.lt`/`.gte`) and ordered on in /my-work (the busiest page — every
--   overdue/due-today/upcoming bucket filters on it) and read on nearly
--   every task list. tasks.status and the *_person_id columns already had
--   indexes (0003_work_core.sql); deadline was the one gap.
-- - person_roles.person_id had no plain index — only two partial unique
--   indexes, split on `organization_id is [not] null`
--   (0002_foundation_corrections.sql), neither of which a plain
--   `where person_id = x` (no organization_id filter) can use alone. This
--   exact query runs in getCurrentUser() (src/lib/auth.ts), i.e. on every
--   authenticated request.
--
-- Everything else on the requested checklist (project_id, organization_id,
-- person_id elsewhere, assignee_person_id, current_holder_person_id,
-- status, team_id) already has a covering index or primary key from
-- 0002/0003/0008 — see the audit report for the full trace.
--
-- One more gap surfaced by EXPLAIN ANALYZE (with 200k synthetic tasks) that
-- wasn't on the original checklist but was too costly to leave alone:
-- tasks_assignee_person_id_idx already existed, but reviewer_person_id and
-- approver_person_id didn't. Every "tasks I'm involved in" query (the
-- my-work page's core query, now a single query after this same audit's
-- app-level fix) filters `assignee = X OR reviewer = X OR approver = X`,
-- and Postgres can't use a partial-column index for an OR unless every
-- branch is indexed — one un-indexed branch forces a full scan of the
-- whole table for the entire OR, not just that branch. Confirmed via
-- EXPLAIN ANALYZE: 14.9ms parallel seq scan before these two indexes,
-- 0.1ms bitmap-or index scan after, on the exact same 200k-row query. The
-- same three-column OR pattern is also inside can_view_project() and
-- can_view_task() (0003_work_core.sql), which run on nearly every
-- project/task read via RLS — so this affects far more than just my-work.

create index tasks_deadline_idx on tasks (deadline);

create index person_roles_person_id_idx on person_roles (person_id);

create index tasks_reviewer_person_id_idx on tasks (reviewer_person_id);

create index tasks_approver_person_id_idx on tasks (approver_person_id);

-- ---------------------------------------------------------------------------
-- Rollback:
--
-- drop index if exists tasks_approver_person_id_idx;
-- drop index if exists tasks_reviewer_person_id_idx;
-- drop index if exists person_roles_person_id_idx;
-- drop index if exists tasks_deadline_idx;
