# WorkBoard 2.0 — Test Checklist

## Automated (run before every user test round)

```bash
supabase start          # local Supabase stack (needs Docker)
supabase db reset       # applies supabase/migrations/*.sql in order, then supabase/seed.sql
psql "$(supabase status -o json | jq -r '.DB_URL')" \
  -v ON_ERROR_STOP=1 -f supabase/tests/workflow_and_rls.sql
psql "$(supabase status -o json | jq -r '.DB_URL')" \
  -v ON_ERROR_STOP=1 -f supabase/tests/weekly_planner_rls.sql
psql "$(supabase status -o json | jq -r '.DB_URL')" \
  -v ON_ERROR_STOP=1 -f supabase/tests/timer_flow.sql
```

`workflow_and_rls.sql` must print `ALL CHECKS PASSED` at the end. It covers:

- RLS visibility: MEMBER sees only their own tasks; HEAD sees only their
  org's project/tasks; EXECUTIVE reads everything but can't write.
- Full workflow: Assigned → Acknowledged → In Progress → Submitted →
  In Review → Revision Required → Resubmitted → In Review →
  Pending Approval → Approved → Completed.
- The Milestone 3.1 fix: a reviewer cannot approve directly once an
  approver is set; an uninvolved person is blocked at Pending Approval;
  the actual approver can.
- Cross-org denial: HEAD-A cannot act on an Org B task.
- Time tracking: double clock-in rejected, only one active task timer at
  a time, switch/pause/clock-out behave correctly.
- Milestone 5.1 fix: HEAD-B cannot see or correct an Org A member's time
  data; HEAD-A (same org) can; EXECUTIVE cannot correct anything.

`timer_flow.sql` must print `ALL TIMER FLOW CHECKS PASSED`. Written after a
production report that the timer button silently did nothing. It covers:

- Every start_task_timer()/switch_task_timer() precondition on its own:
  rejected before Clock In, rejected while on break, rejected for an
  uninvolved person (before their own attendance is even checked).
- The full reported flow: start → running → pause → start again → switch.
- Permission matrix: the assignee, an org-HEAD (not the assignee), and
  ADMIN can all use the timer — each on their own attendance, not the
  task's assignee's.

If the run breaks a step, it stops there with `ASSERTION_FAILURE: ...` (a
real regression) or a plain Postgres error (something else broke).

## Seed accounts (`supabase/seed.sql`, password `Password123!`)

| Email | Role | Org |
|---|---|---|
| admin@test.local | ADMIN | — (global) |
| executive@test.local | EXECUTIVE | — (global) |
| head-a@test.local | HEAD | องค์กร A |
| head-b@test.local | HEAD | องค์กร B |
| member-a@test.local | MEMBER | องค์กร A |
| member-b@test.local | MEMBER | องค์กร B |

Seeded: 1 network, Org A/B, 1 team + 1 project + 1 workstream per org, 4
tasks (t1 full-lifecycle w/ reviewer+approver, t2 no-approver, t3
P1+overdue, t4 blocked).

## Manual (needs a running app against this seed)

- [ ] Log in as each seed account; confirm the sidebar only shows what
      that role should see (ภาพรวมผู้บริหาร only for ADMIN/EXECUTIVE).
- [ ] member-a: `/my-work` shows t1/t3/t4 only, not t2.
- [ ] member-a: walk t1 through the full workflow via Task Detail buttons
      (mirrors the automated script) — confirm the button shown always
      matches what the current user is allowed to do.
- [ ] head-a: `/projects/[project A]` → click "ใช้ Playbook" → workstreams
      + tasks appear; click again → no duplicates (idempotent).
- [ ] Project Completeness panel shows real gaps (missing deadline/
      reviewer, empty workstream) for a freshly-played-back project.
- [ ] executive: `/executive` — expand Network → Org → Project → Task;
      counts (open tasks, health, overdue/blocked/waiting) match the
      seeded data.
- [ ] head-a: `/teams/[ทีมองค์กร A]` shows only Org A members' numbers;
      head-b's team page shows Org B's.
- [ ] member-a: Clock In → start a task timer → switch to another task →
      pause → Clock Out, all from `/my-work` and the task detail page;
      confirm the running-task banner appears/disappears correctly.
- [ ] Confirm a corrected time entry never looks identical to an
      untouched one (source badge/label differs) — no UI currently
      exposes `source` directly; this is a known gap, see README.

## Vercel / deployment smoke test

- [ ] `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in
      Vercel project env (Production + Preview).
- [ ] Migrations 0001-0009 applied to the target Supabase project, in
      order, then a *sanitized* seed only if the target is a test/staging
      project — never run `seed.sql` against a project with real users.
- [ ] First real ADMIN created manually (Supabase Auth user + matching
      `people` row + `person_roles` ADMIN grant) per README.
- [ ] `npm run build` succeeds with those env vars present at build time.
