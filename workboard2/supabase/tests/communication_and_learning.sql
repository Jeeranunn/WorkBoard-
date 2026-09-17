-- WorkBoard 2.0 — Communication + Learning (migration 0028, hardened by
-- 0030/0031) regression suite.
--
-- Prerequisites: run supabase/seed.sql first. Run this AS a non-superuser,
-- non-bypassrls role granted the `authenticated` privileges (so RLS
-- actually applies, matching how PostgREST connects).
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/communication_and_learning.sql
--
-- Prints "OK: ..." for each passing check. Aborts with an error on the
-- first failing one.
--
-- People (from seed.sql):
--   admin    person=20000000-...0001  auth=10000000-...0001
--   exec     person=20000000-...0002  auth=10000000-...0002  (EXECUTIVE)
--   head-a   person=20000000-...0003  auth=10000000-...0003  (HEAD, org A)
--   head-b   person=20000000-...0004  auth=10000000-...0004  (HEAD, org B)
--   member-a person=20000000-...0005  auth=10000000-...0005  (MEMBER, org A)
--   member-b person=20000000-...0006  auth=10000000-...0006  (MEMBER, org B)

-- ===========================================================================
-- 1. learning_reflections — owner isolation.
-- ===========================================================================

set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A
insert into learning_reflections (person_id, meeting_name, meeting_date, note)
values ('20000000-0000-0000-0000-000000000005', 'ประชุมทดสอบ', current_date, 'สรุปทดสอบ');

do $$
declare n int;
begin
  select count(*) into n from learning_reflections where person_id = '20000000-0000-0000-0000-000000000005';
  if n <> 1 then raise exception 'ASSERTION_FAILURE: MEMBER-A cannot see own reflection'; end if;
  raise notice 'OK: MEMBER-A sees their own reflection';
end $$;

do $$
declare failed boolean := false;
begin
  begin
    insert into learning_reflections (person_id, meeting_name, meeting_date, note)
    values ('20000000-0000-0000-0000-000000000006', 'แอบใส่ให้คนอื่น', current_date, 'x');
  exception when others then
    failed := true;
  end;
  if not failed then
    raise exception 'ASSERTION_FAILURE: MEMBER-A inserted a reflection owned by someone else';
  end if;
  raise notice 'OK: MEMBER-A cannot insert a reflection for another person';
end $$;

set app.current_uid = '10000000-0000-0000-0000-000000000006'; -- MEMBER-B
do $$
declare n int;
begin
  select count(*) into n from learning_reflections where person_id = '20000000-0000-0000-0000-000000000005';
  if n <> 0 then raise exception 'ASSERTION_FAILURE: MEMBER-B can see MEMBER-A reflection (RLS leak)'; end if;
  raise notice 'OK: MEMBER-B cannot see MEMBER-A''s reflection';
end $$;

-- ===========================================================================
-- 2. executive_questions — visibility, reply, hardened UPDATE, withdraw RPC.
-- ===========================================================================

set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A
select send_executive_question('คำถามกระจายทั่วไป', null);
select send_executive_question('คำถามเจาะจงถึงผู้บริหาร', '20000000-0000-0000-0000-000000000002');

do $$
declare n int;
begin
  select count(*) into n from executive_questions where sender_person_id = '20000000-0000-0000-0000-000000000005';
  if n <> 2 then raise exception 'ASSERTION_FAILURE: MEMBER-A should see own 2 questions, saw %', n; end if;
  raise notice 'OK: MEMBER-A sees both questions they sent';
end $$;

set app.current_uid = '10000000-0000-0000-0000-000000000006'; -- MEMBER-B
do $$
declare n int;
begin
  select count(*) into n from executive_questions where sender_person_id = '20000000-0000-0000-0000-000000000005';
  if n <> 0 then raise exception 'ASSERTION_FAILURE: MEMBER-B can see MEMBER-A questions (RLS leak)'; end if;
  raise notice 'OK: MEMBER-B cannot see MEMBER-A''s questions';
end $$;

set app.current_uid = '10000000-0000-0000-0000-000000000002'; -- EXECUTIVE
do $$
declare n int;
begin
  select count(*) into n from executive_questions
  where status = 'OPEN' and (recipient_person_id is null or recipient_person_id = '20000000-0000-0000-0000-000000000002');
  if n <> 2 then raise exception 'ASSERTION_FAILURE: EXECUTIVE should see 2 open questions (broadcast+targeted), saw %', n; end if;
  raise notice 'OK: EXECUTIVE sees the broadcast and the targeted question';
end $$;

do $$
declare qid uuid;
begin
  select id into qid from executive_questions
  where sender_person_id = '20000000-0000-0000-0000-000000000005'
    and recipient_person_id = '20000000-0000-0000-0000-000000000002';
  perform reply_executive_question(qid, 'คำตอบจากผู้บริหาร');
  if (select status from executive_questions where id = qid) <> 'ANSWERED' then
    raise exception 'ASSERTION_FAILURE: reply_executive_question did not mark ANSWERED';
  end if;
  raise notice 'OK: reply_executive_question answers the targeted question';
end $$;

set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A
do $$
declare n int;
begin
  select count(*) into n from executive_question_replies r
  join executive_questions q on q.id = r.question_id
  where q.sender_person_id = '20000000-0000-0000-0000-000000000005';
  if n <> 1 then raise exception 'ASSERTION_FAILURE: MEMBER-A cannot see the reply to their own question'; end if;
  raise notice 'OK: MEMBER-A can read the executive''s reply';
end $$;

set app.current_uid = '10000000-0000-0000-0000-000000000006'; -- MEMBER-B
do $$
declare n int;
begin
  select count(*) into n from executive_question_replies r
  join executive_questions q on q.id = r.question_id
  where q.sender_person_id = '20000000-0000-0000-0000-000000000005';
  if n <> 0 then raise exception 'ASSERTION_FAILURE: MEMBER-B can see a reply to MEMBER-A''s question (RLS leak)'; end if;
  raise notice 'OK: MEMBER-B cannot read a reply to someone else''s question';
end $$;

-- --- hardened UPDATE: 0031 dropped "question sender update" entirely, so
-- --- direct client updates must now affect zero rows, whoever is asking.
set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A (the actual sender)
do $$
declare
  qid_answered uuid;
  qid_open uuid;
  original_question text;
  n int;
begin
  select id, question into qid_answered, original_question from executive_questions
  where sender_person_id = '20000000-0000-0000-0000-000000000005' and status = 'ANSWERED';
  select id into qid_open from executive_questions
  where sender_person_id = '20000000-0000-0000-0000-000000000005' and recipient_person_id is null;

  -- (a) sender cannot reopen an ANSWERED question directly.
  update executive_questions set status = 'OPEN' where id = qid_answered;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ASSERTION_FAILURE: sender directly reopened an ANSWERED question (% rows)', n; end if;
  if (select status from executive_questions where id = qid_answered) <> 'ANSWERED' then
    raise exception 'ASSERTION_FAILURE: ANSWERED question status changed via direct update';
  end if;

  -- (b) sender cannot reassign the recipient directly.
  update executive_questions set recipient_person_id = '20000000-0000-0000-0000-000000000003' where id = qid_open;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ASSERTION_FAILURE: sender directly changed recipient_person_id (% rows)', n; end if;
  if (select recipient_person_id from executive_questions where id = qid_open) is not null then
    raise exception 'ASSERTION_FAILURE: recipient_person_id changed via direct update';
  end if;

  -- (c) sender cannot rewrite the question text directly.
  update executive_questions set question = 'แก้ไขข้อความโดยตรง' where id = qid_open;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ASSERTION_FAILURE: sender directly rewrote question text (% rows)', n; end if;
  if (select question from executive_questions where id = qid_answered) <> original_question then
    raise exception 'ASSERTION_FAILURE: question text changed via direct update';
  end if;

  raise notice 'OK: direct UPDATE on executive_questions is fully blocked for the sender (reopen / recipient / text)';
end $$;

-- (d) even ADMIN cannot bypass the RPCs with a direct update — 0031 drops
-- the policy entirely rather than narrowing it, matching meeting_requests
-- (which never had a direct-update policy for anyone, admin included).
-- ADMIN can still locate the row (their read policy includes is_admin()),
-- so this exercises the UPDATE-side denial specifically, not just SELECT
-- invisibility.
set app.current_uid = '10000000-0000-0000-0000-000000000001'; -- ADMIN
do $$
declare
  qid_open uuid;
  n int;
begin
  select id into qid_open from executive_questions
  where sender_person_id = '20000000-0000-0000-0000-000000000005' and recipient_person_id is null;

  update executive_questions set status = 'WITHDRAWN' where id = qid_open;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ASSERTION_FAILURE: ADMIN directly updated executive_questions (% rows)', n; end if;
  if (select status from executive_questions where id = qid_open) <> 'OPEN' then
    raise exception 'ASSERTION_FAILURE: question status changed via ADMIN direct update';
  end if;
  raise notice 'OK: direct UPDATE on executive_questions is blocked for ADMIN too — RPCs only';
end $$;

set app.current_uid = '10000000-0000-0000-0000-000000000006'; -- MEMBER-B
do $$
declare
  failed boolean := false;
  qid_open uuid;
begin
  select id into qid_open from executive_questions
  where sender_person_id = '20000000-0000-0000-0000-000000000005' and recipient_person_id is null;
  begin
    perform withdraw_executive_question(qid_open);
  exception when others then
    failed := true;
  end;
  if not failed then raise exception 'ASSERTION_FAILURE: MEMBER-B withdrew a question they did not send'; end if;
  raise notice 'OK: withdraw_executive_question blocks a non-sender (impersonation)';
end $$;

-- --- illegal state transitions via the RPC itself.
set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A
do $$
declare
  qid_answered uuid;
  failed boolean := false;
begin
  select id into qid_answered from executive_questions
  where sender_person_id = '20000000-0000-0000-0000-000000000005' and status = 'ANSWERED';
  begin
    perform withdraw_executive_question(qid_answered);
  exception when others then
    failed := true;
  end;
  if not failed then raise exception 'ASSERTION_FAILURE: withdrawing an ANSWERED question should have failed'; end if;
  raise notice 'OK: withdraw_executive_question refuses an already-ANSWERED question';
end $$;

-- --- the one legitimate transition: the valid withdraw RPC succeeds.
do $$
declare qid_open uuid;
begin
  select id into qid_open from executive_questions
  where sender_person_id = '20000000-0000-0000-0000-000000000005' and recipient_person_id is null;
  perform withdraw_executive_question(qid_open);
  if (select status from executive_questions where id = qid_open) <> 'WITHDRAWN' then
    raise exception 'ASSERTION_FAILURE: withdraw_executive_question did not mark WITHDRAWN';
  end if;
  raise notice 'OK: withdraw_executive_question succeeds on the sender''s own OPEN question';
end $$;

do $$
declare
  qid_withdrawn uuid;
  failed boolean := false;
begin
  select id into qid_withdrawn from executive_questions
  where sender_person_id = '20000000-0000-0000-0000-000000000005' and status = 'WITHDRAWN';
  begin
    perform withdraw_executive_question(qid_withdrawn);
  exception when others then
    failed := true;
  end;
  if not failed then raise exception 'ASSERTION_FAILURE: double-withdrawing a question should have failed'; end if;
  raise notice 'OK: withdraw_executive_question refuses to withdraw an already-WITHDRAWN question';
end $$;

-- ===========================================================================
-- 3. meeting_requests — create, respond, reschedule-confirm, cancel rules.
-- ===========================================================================

set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A
select create_meeting_request('หารือเรื่องงาน', now() + interval '3 days', 30, 'ห้องประชุม 1', '20000000-0000-0000-0000-000000000002');
select create_meeting_request('ขอคำปรึกษา', now() + interval '5 days', 45, null, null);

set app.current_uid = '10000000-0000-0000-0000-000000000002'; -- EXECUTIVE
do $$
declare n int;
begin
  select count(*) into n from meeting_requests
  where status = 'PENDING' and (recipient_person_id is null or recipient_person_id = '20000000-0000-0000-0000-000000000002');
  if n <> 2 then raise exception 'ASSERTION_FAILURE: EXECUTIVE should see 2 pending meeting requests, saw %', n; end if;
  raise notice 'OK: EXECUTIVE sees both pending meeting requests';
end $$;

do $$
declare
  mid_targeted uuid;
  mid_broadcast uuid;
begin
  select id into mid_targeted from meeting_requests where topic = 'หารือเรื่องงาน';
  select id into mid_broadcast from meeting_requests where topic = 'ขอคำปรึกษา';
  perform respond_meeting_request(mid_targeted, 'RESCHEDULE_PROPOSED', 'ขอเลื่อน', now() + interval '4 days', 'ห้องประชุม 2');
  perform respond_meeting_request(mid_broadcast, 'ACCEPTED', null, null, null);
  raise notice 'OK: EXECUTIVE can propose a reschedule and accept a meeting request';
end $$;

set app.current_uid = '10000000-0000-0000-0000-000000000006'; -- MEMBER-B
do $$
declare n int;
begin
  select count(*) into n from meeting_requests where sender_person_id = '20000000-0000-0000-0000-000000000005';
  if n <> 0 then raise exception 'ASSERTION_FAILURE: MEMBER-B can see MEMBER-A meeting requests (RLS leak)'; end if;
  raise notice 'OK: MEMBER-B cannot see MEMBER-A''s meeting requests';
end $$;

set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A
do $$
declare
  mid uuid;
  st text;
  req_start timestamptz;
  prop_start timestamptz;
begin
  select id, proposed_start into mid, prop_start from meeting_requests where topic = 'หารือเรื่องงาน';
  perform confirm_meeting_reschedule(mid);
  select status, requested_start into st, req_start from meeting_requests where id = mid;
  if st <> 'ACCEPTED' then raise exception 'ASSERTION_FAILURE: confirm_meeting_reschedule did not set ACCEPTED, got %', st; end if;
  if req_start <> prop_start then raise exception 'ASSERTION_FAILURE: requested_start not updated to proposed_start'; end if;
  raise notice 'OK: sender can confirm a proposed reschedule, which applies the new time';
end $$;

do $$
declare
  mid uuid;
  failed boolean := false;
begin
  select id into mid from meeting_requests where topic = 'ขอคำปรึกษา';
  begin
    perform cancel_meeting_request(mid);
  exception when others then
    failed := true;
  end;
  if not failed then raise exception 'ASSERTION_FAILURE: cancelling an already-ACCEPTED meeting should have failed'; end if;
  raise notice 'OK: cancel_meeting_request refuses an already-ACCEPTED meeting';
end $$;

-- ===========================================================================
-- 4. management_memos / management_memo_recipients — send, visibility,
--    acknowledgement, and the 0030 RLS-recursion fix.
-- ===========================================================================

set app.current_uid = '10000000-0000-0000-0000-000000000005'; -- MEMBER-A
do $$
declare failed boolean := false;
begin
  begin
    perform send_management_memo('บันทึกที่ไม่ควรส่งได้', null, null);
  exception when others then
    failed := true;
  end;
  if not failed then raise exception 'ASSERTION_FAILURE: a MEMBER should not be able to send a management memo'; end if;
  raise notice 'OK: send_management_memo refuses a MEMBER sender';
end $$;

set app.current_uid = '10000000-0000-0000-0000-000000000003'; -- HEAD-A
select send_management_memo('แจ้งเตือนจากหัวหน้าฝ่าย A', 'รายละเอียดทดสอบ', null);

do $$
declare
  recipient_cnt int;
  exec_cnt int;
begin
  select count(*) into recipient_cnt from management_memo_recipients r
  join management_memos m on m.id = r.memo_id
  where m.sender_person_id = '20000000-0000-0000-0000-000000000003';
  select count(*) into exec_cnt from management_memo_recipients r
  join management_memos m on m.id = r.memo_id
  where m.sender_person_id = '20000000-0000-0000-0000-000000000003'
    and r.recipient_person_id = '20000000-0000-0000-0000-000000000002';
  if recipient_cnt <> 1 then raise exception 'ASSERTION_FAILURE: memo should have exactly 1 recipient, got %', recipient_cnt; end if;
  if exec_cnt <> 1 then raise exception 'ASSERTION_FAILURE: the active executive should be the recipient'; end if;
  raise notice 'OK: send_management_memo auto-populates recipients to active executives (join query — exercises the 0030 RLS fix)';
end $$;

set app.current_uid = '10000000-0000-0000-0000-000000000004'; -- HEAD-B
do $$
declare n int;
begin
  select count(*) into n from management_memos where sender_person_id = '20000000-0000-0000-0000-000000000003';
  if n <> 0 then raise exception 'ASSERTION_FAILURE: HEAD-B can see HEAD-A''s memo (RLS leak)'; end if;
  raise notice 'OK: HEAD-B cannot see HEAD-A''s memo (cross-HEAD isolation)';
end $$;

set app.current_uid = '10000000-0000-0000-0000-000000000006'; -- MEMBER-B
do $$
declare n int;
begin
  select count(*) into n from management_memos where sender_person_id = '20000000-0000-0000-0000-000000000003';
  if n <> 0 then raise exception 'ASSERTION_FAILURE: MEMBER-B can see HEAD-A''s memo (RLS leak)'; end if;
  raise notice 'OK: a MEMBER not addressed by the memo cannot see it';
end $$;

set app.current_uid = '10000000-0000-0000-0000-000000000002'; -- EXECUTIVE (the recipient)
do $$
declare mid uuid;
begin
  select m.id into mid from management_memos m where m.sender_person_id = '20000000-0000-0000-0000-000000000003';
  perform acknowledge_management_memo(mid);
  raise notice 'OK: EXECUTIVE can acknowledge a memo addressed to them';
end $$;

set app.current_uid = '10000000-0000-0000-0000-000000000003'; -- HEAD-A (the sender)
do $$
declare acked timestamptz;
begin
  select r.acknowledged_at into acked from management_memo_recipients r
  join management_memos m on m.id = r.memo_id
  where m.sender_person_id = '20000000-0000-0000-0000-000000000003'
    and r.recipient_person_id = '20000000-0000-0000-0000-000000000002';
  if acked is null then raise exception 'ASSERTION_FAILURE: HEAD-A (sender) cannot see the executive''s acknowledgement'; end if;
  raise notice 'OK: the sending HEAD can see the recipient''s acknowledgement status';
end $$;

reset app.current_uid;
select 'ALL COMMUNICATION AND LEARNING CHECKS PASSED' as result;
