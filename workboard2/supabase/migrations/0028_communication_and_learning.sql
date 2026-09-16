-- WorkBoard 2.0 — learning reflections + executive communication.
-- Designed as a lightweight module: read screens use small indexed tables in
-- parallel, while writes and state transitions use validated RPCs.

create type executive_question_status as enum ('OPEN','ANSWERED','WITHDRAWN');
create type meeting_request_status as enum (
  'PENDING','ACCEPTED','DECLINED','RESCHEDULE_PROPOSED','CANCELLED'
);

create table learning_reflections (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id),
  meeting_name text not null,
  meeting_date date not null,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table executive_questions (
  id uuid primary key default gen_random_uuid(),
  sender_person_id uuid not null references people(id),
  recipient_person_id uuid references people(id),
  question text not null,
  status executive_question_status not null default 'OPEN',
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table executive_question_replies (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references executive_questions(id) on delete cascade,
  author_person_id uuid not null references people(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table meeting_requests (
  id uuid primary key default gen_random_uuid(),
  sender_person_id uuid not null references people(id),
  recipient_person_id uuid references people(id),
  topic text not null,
  requested_start timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  location text,
  status meeting_request_status not null default 'PENDING',
  executive_remark text,
  proposed_start timestamptz,
  proposed_location text,
  responded_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table management_memos (
  id uuid primary key default gen_random_uuid(),
  sender_person_id uuid not null references people(id),
  subject text not null,
  body text,
  link text,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table management_memo_recipients (
  memo_id uuid not null references management_memos(id) on delete cascade,
  recipient_person_id uuid not null references people(id),
  acknowledged_at timestamptz,
  primary key (memo_id, recipient_person_id)
);

create index learning_reflections_person_date_idx
  on learning_reflections(person_id, meeting_date desc);
create index executive_questions_sender_created_idx
  on executive_questions(sender_person_id, created_at desc);
create index executive_questions_recipient_status_idx
  on executive_questions(recipient_person_id, status, created_at desc);
create index executive_question_replies_question_created_idx
  on executive_question_replies(question_id, created_at);
create index meeting_requests_sender_created_idx
  on meeting_requests(sender_person_id, created_at desc);
create index meeting_requests_recipient_status_idx
  on meeting_requests(recipient_person_id, status, requested_start);
create index management_memos_sender_created_idx
  on management_memos(sender_person_id, created_at desc);
create index management_memo_recipients_person_ack_idx
  on management_memo_recipients(recipient_person_id, acknowledged_at);

alter table learning_reflections enable row level security;
alter table executive_questions enable row level security;
alter table executive_question_replies enable row level security;
alter table meeting_requests enable row level security;
alter table management_memos enable row level security;
alter table management_memo_recipients enable row level security;

create policy "reflection owner read" on learning_reflections
for select using (person_id = current_person_id() or is_admin());

create policy "reflection owner write" on learning_reflections
for all using (person_id = current_person_id() or is_admin())
with check (person_id = current_person_id() or is_admin());

create policy "question participant read" on executive_questions
for select using (
  sender_person_id = current_person_id()
  or is_admin()
  or (
    is_executive()
    and (
      recipient_person_id is null
      or recipient_person_id = current_person_id()
    )
  )
);

create policy "question sender insert" on executive_questions
for insert with check (sender_person_id = current_person_id());

create policy "question sender update" on executive_questions
for update using (sender_person_id = current_person_id() or is_admin());

create policy "question reply participant read" on executive_question_replies
for select using (
  exists (
    select 1 from executive_questions q
    where q.id = question_id
      and (
        q.sender_person_id = current_person_id()
        or is_admin()
        or (
          is_executive()
          and (q.recipient_person_id is null or q.recipient_person_id = current_person_id())
        )
      )
  )
);

create policy "meeting participant read" on meeting_requests
for select using (
  sender_person_id = current_person_id()
  or is_admin()
  or (
    is_executive()
    and (
      recipient_person_id is null
      or recipient_person_id = current_person_id()
    )
  )
);

create policy "meeting sender insert" on meeting_requests
for insert with check (sender_person_id = current_person_id());

create policy "memo sender read" on management_memos
for select using (
  sender_person_id = current_person_id()
  or is_admin()
  or exists (
    select 1 from management_memo_recipients r
    where r.memo_id = id and r.recipient_person_id = current_person_id()
  )
);

create policy "memo recipient read" on management_memo_recipients
for select using (
  recipient_person_id = current_person_id()
  or is_admin()
  or exists (
    select 1 from management_memos m
    where m.id = memo_id and m.sender_person_id = current_person_id()
  )
);

create function active_executive_people()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct pr.person_id
  from person_roles pr
  where pr.role = 'EXECUTIVE'
    and pr.organization_id is null
    and pr.valid_from <= current_date
    and (pr.valid_to is null or pr.valid_to >= current_date);
$$;

create function send_executive_question(
  p_question text,
  p_recipient_person_id uuid default null
)
returns executive_questions
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  result executive_questions;
begin
  if actor_id is null then raise exception 'ต้องเข้าสู่ระบบ'; end if;
  if coalesce(trim(p_question),'') = '' then raise exception 'กรุณาพิมพ์คำถาม'; end if;

  if p_recipient_person_id is not null and not exists (
    select 1 from active_executive_people() id where id = p_recipient_person_id
  ) then
    raise exception 'ผู้รับไม่ใช่ผู้บริหารที่ใช้งานอยู่';
  end if;

  insert into executive_questions(sender_person_id, recipient_person_id, question)
  values(actor_id, p_recipient_person_id, trim(p_question))
  returning * into result;
  return result;
end;
$$;

create function reply_executive_question(
  p_question_id uuid,
  p_body text
)
returns executive_question_replies
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  q executive_questions;
  result executive_question_replies;
begin
  select * into q from executive_questions where id = p_question_id for update;
  if not found then raise exception 'ไม่พบคำถาม'; end if;
  if not is_admin() and not (
    is_executive() and (q.recipient_person_id is null or q.recipient_person_id = actor_id)
  ) then
    raise exception 'ไม่มีสิทธิ์ตอบคำถามนี้';
  end if;
  if q.status = 'WITHDRAWN' then raise exception 'คำถามถูกถอนแล้ว'; end if;
  if coalesce(trim(p_body),'') = '' then raise exception 'กรุณาพิมพ์คำตอบ'; end if;

  insert into executive_question_replies(question_id, author_person_id, body)
  values(p_question_id, actor_id, trim(p_body))
  returning * into result;

  update executive_questions
  set status = 'ANSWERED', updated_at = now()
  where id = p_question_id;

  return result;
end;
$$;

create function withdraw_executive_question(p_question_id uuid)
returns executive_questions
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  result executive_questions;
begin
  update executive_questions
  set status = 'WITHDRAWN', withdrawn_at = now(), updated_at = now()
  where id = p_question_id
    and sender_person_id = actor_id
    and status = 'OPEN'
  returning * into result;
  if result.id is null then raise exception 'ถอนคำถามนี้ไม่ได้'; end if;
  return result;
end;
$$;

create function create_meeting_request(
  p_topic text,
  p_requested_start timestamptz,
  p_duration_minutes integer,
  p_location text default null,
  p_recipient_person_id uuid default null
)
returns meeting_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  result meeting_requests;
begin
  if actor_id is null then raise exception 'ต้องเข้าสู่ระบบ'; end if;
  if coalesce(trim(p_topic),'') = '' then raise exception 'กรุณาระบุหัวข้อ'; end if;
  if p_duration_minutes <= 0 then raise exception 'ระยะเวลาต้องมากกว่า 0'; end if;
  if p_recipient_person_id is not null and not exists (
    select 1 from active_executive_people() id where id = p_recipient_person_id
  ) then
    raise exception 'ผู้รับไม่ใช่ผู้บริหารที่ใช้งานอยู่';
  end if;

  insert into meeting_requests(
    sender_person_id, recipient_person_id, topic, requested_start,
    duration_minutes, location
  ) values(
    actor_id, p_recipient_person_id, trim(p_topic), p_requested_start,
    p_duration_minutes, nullif(trim(coalesce(p_location,'')),'')
  )
  returning * into result;
  return result;
end;
$$;

create function respond_meeting_request(
  p_request_id uuid,
  p_status meeting_request_status,
  p_remark text default null,
  p_proposed_start timestamptz default null,
  p_proposed_location text default null
)
returns meeting_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  req meeting_requests;
  result meeting_requests;
begin
  select * into req from meeting_requests where id = p_request_id for update;
  if not found then raise exception 'ไม่พบคำขอนัดหมาย'; end if;
  if not is_admin() and not (
    is_executive() and (req.recipient_person_id is null or req.recipient_person_id = actor_id)
  ) then
    raise exception 'ไม่มีสิทธิ์ตอบคำขอนัดหมายนี้';
  end if;
  if p_status not in ('ACCEPTED','DECLINED','RESCHEDULE_PROPOSED') then
    raise exception 'สถานะไม่ถูกต้อง';
  end if;
  if p_status = 'RESCHEDULE_PROPOSED' and p_proposed_start is null then
    raise exception 'กรุณาระบุเวลาใหม่';
  end if;

  update meeting_requests
  set
    status = p_status,
    executive_remark = nullif(trim(coalesce(p_remark,'')),''),
    proposed_start = case when p_status = 'RESCHEDULE_PROPOSED' then p_proposed_start else null end,
    proposed_location = case when p_status = 'RESCHEDULE_PROPOSED'
      then nullif(trim(coalesce(p_proposed_location,'')),'') else null end,
    responded_at = now(),
    updated_at = now()
  where id = p_request_id
  returning * into result;
  return result;
end;
$$;

create function confirm_meeting_reschedule(p_request_id uuid)
returns meeting_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  result meeting_requests;
begin
  update meeting_requests
  set
    requested_start = proposed_start,
    location = coalesce(proposed_location, location),
    status = 'ACCEPTED',
    proposed_start = null,
    proposed_location = null,
    updated_at = now()
  where id = p_request_id
    and sender_person_id = actor_id
    and status = 'RESCHEDULE_PROPOSED'
    and proposed_start is not null
  returning * into result;
  if result.id is null then raise exception 'ยืนยันเวลาใหม่นี้ไม่ได้'; end if;
  return result;
end;
$$;

create function cancel_meeting_request(p_request_id uuid)
returns meeting_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  result meeting_requests;
begin
  update meeting_requests
  set status = 'CANCELLED', cancelled_at = now(), updated_at = now()
  where id = p_request_id
    and sender_person_id = actor_id
    and status in ('PENDING','RESCHEDULE_PROPOSED')
  returning * into result;
  if result.id is null then raise exception 'ยกเลิกคำขอนัดหมายนี้ไม่ได้'; end if;
  return result;
end;
$$;

create function send_management_memo(
  p_subject text,
  p_body text default null,
  p_link text default null
)
returns management_memos
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := current_person_id();
  memo management_memos;
begin
  if actor_id is null then raise exception 'ต้องเข้าสู่ระบบ'; end if;
  if not is_admin() and not exists (
    select 1
    from person_roles pr
    where pr.person_id = actor_id
      and pr.role = 'HEAD'
      and pr.valid_from <= current_date
      and (pr.valid_to is null or pr.valid_to >= current_date)
  ) then
    raise exception 'เฉพาะหัวหน้าฝ่ายหรือผู้ดูแลระบบเท่านั้นที่ส่งบันทึกข้อความได้';
  end if;
  if coalesce(trim(p_subject),'') = '' then raise exception 'กรุณาระบุหัวข้อ'; end if;

  insert into management_memos(sender_person_id, subject, body, link)
  values(
    actor_id, trim(p_subject),
    nullif(trim(coalesce(p_body,'')),''),
    nullif(trim(coalesce(p_link,'')),'')
  )
  returning * into memo;

  insert into management_memo_recipients(memo_id, recipient_person_id)
  select memo.id, id from active_executive_people();

  return memo;
end;
$$;

create function acknowledge_management_memo(p_memo_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update management_memo_recipients
  set acknowledged_at = coalesce(acknowledged_at, now())
  where memo_id = p_memo_id
    and recipient_person_id = current_person_id();

  if not found and not is_admin() then
    raise exception 'ไม่มีสิทธิ์รับทราบบันทึกนี้';
  end if;
end;
$$;

grant execute on function active_executive_people() to authenticated;
grant execute on function send_executive_question(text, uuid) to authenticated;
grant execute on function reply_executive_question(uuid, text) to authenticated;
grant execute on function withdraw_executive_question(uuid) to authenticated;
grant execute on function create_meeting_request(text, timestamptz, integer, text, uuid) to authenticated;
grant execute on function respond_meeting_request(uuid, meeting_request_status, text, timestamptz, text) to authenticated;
grant execute on function confirm_meeting_reschedule(uuid) to authenticated;
grant execute on function cancel_meeting_request(uuid) to authenticated;
grant execute on function send_management_memo(text, text, text) to authenticated;
grant execute on function acknowledge_management_memo(uuid) to authenticated;
