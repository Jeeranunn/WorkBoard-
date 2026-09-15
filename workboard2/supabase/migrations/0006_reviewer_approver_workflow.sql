-- WorkBoard 2.0 — Milestone 3.1: Reviewer / Approver Workflow Correction
--
-- Bug: when a task had both reviewer_person_id and approver_person_id set,
-- current_holder_person_id at IN_REVIEW resolved to the reviewer, and
-- approve_task authorized on "is current holder" — so the reviewer could
-- approve the task themselves and the approver was never actually involved.
--
-- Fix: a task with an approver must pass through a new PENDING_APPROVAL
-- state, held by the approver specifically, before it can be approved.
-- Only when there is no approver at all can the reviewer (or, if there's
-- no reviewer either, the assignee) approve directly from IN_REVIEW.
--
-- Additive only: modifies existing functions via CREATE OR REPLACE and
-- adds a new enum value + one new table constraint. Does not edit
-- 0001-0005.

-- ---------------------------------------------------------------------------
-- New status: PENDING_APPROVAL, between IN_REVIEW and APPROVED, held by the
-- approver. Adding an enum value is safe here because it's only ever
-- referenced later, inside function bodies that run in later transactions
-- (never in the same statement that adds it).
-- ---------------------------------------------------------------------------
alter type task_status add value if not exists 'PENDING_APPROVAL' after 'IN_REVIEW';

-- ---------------------------------------------------------------------------
-- Data-integrity backstop: PENDING_APPROVAL only makes sense when there is
-- an approver to hold it. This holds regardless of how the row is written
-- (RPC or a direct ADMIN/org-HEAD update), not just inside submit_for_approval().
-- ---------------------------------------------------------------------------
alter table tasks add constraint tasks_pending_approval_requires_approver
  check (status <> 'PENDING_APPROVAL' or approver_person_id is not null);

-- ---------------------------------------------------------------------------
-- current_holder: PENDING_APPROVAL belongs to the approver. (Falls back to
-- assignee only as a last-resort safety net; the CHECK above means
-- approver_person_id is never actually null here in practice.)
-- ---------------------------------------------------------------------------
create or replace function compute_task_current_holder()
returns trigger
language plpgsql
as $$
begin
  new.current_holder_person_id := case new.status
    when 'SUBMITTED' then coalesce(new.reviewer_person_id, new.approver_person_id, new.assignee_person_id)
    when 'IN_REVIEW' then coalesce(new.reviewer_person_id, new.approver_person_id, new.assignee_person_id)
    when 'RESUBMITTED' then coalesce(new.reviewer_person_id, new.approver_person_id, new.assignee_person_id)
    when 'PENDING_APPROVAL' then coalesce(new.approver_person_id, new.assignee_person_id)
    when 'APPROVED' then null
    when 'COMPLETED' then null
    when 'CANCELLED' then null
    else new.assignee_person_id
  end;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- New RPC: reviewer (or whoever holds the task at IN_REVIEW) hands it to
-- the approver. Only valid when the task actually has an approver — if it
-- doesn't, approve_task (below) is the direct path instead.
-- ---------------------------------------------------------------------------
create function submit_for_approval(p_task_id uuid)
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
    raise exception 'สถานะงานปัจจุบันไม่รองรับการส่งต่อผู้อนุมัติ';
  end if;
  if task_row.approver_person_id is null then
    raise exception 'งานนี้ไม่มีผู้อนุมัติ ให้ใช้คำสั่งอนุมัติงานแทน';
  end if;

  update tasks set status = 'PENDING_APPROVAL' where id = p_task_id;
  return (select t from tasks t where t.id = p_task_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- approve_task: now accepts two origins.
--   - IN_REVIEW: only when there is NO approver (the reviewer, or the
--     assignee if there's no reviewer either, approves directly).
--   - PENDING_APPROVAL: current_holder_person_id is the approver by
--     construction, so the existing is_task_holder_side_actor check
--     already means "actor is the approver" here — no separate
--     is_task_approver_side_actor() needed.
-- Same function signature as 0005, replaced in place.
-- ---------------------------------------------------------------------------
create or replace function approve_task(p_task_id uuid)
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

  if task_row.status = 'IN_REVIEW' then
    if task_row.approver_person_id is not null then
      raise exception 'งานนี้มีผู้อนุมัติ ต้องส่งต่อให้ผู้อนุมัติก่อน (ใช้คำสั่งส่งต่อผู้อนุมัติ)';
    end if;
  elsif task_row.status <> 'PENDING_APPROVAL' then
    raise exception 'สถานะงานปัจจุบันไม่รองรับการอนุมัติ';
  end if;

  update tasks set status = 'APPROVED' where id = p_task_id;
  return (select t from tasks t where t.id = p_task_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Rollback (manual):
--
-- create or replace function approve_task(uuid) ... (restore 0005 version: IN_REVIEW only, no approver check)
-- drop function if exists submit_for_approval(uuid);
-- create or replace function compute_task_current_holder() ... (restore 0004 version, drops PENDING_APPROVAL branch)
-- alter table tasks drop constraint if exists tasks_pending_approval_requires_approver;
-- (PostgreSQL cannot remove an enum value once added; PENDING_APPROVAL would remain a valid but unused label)
