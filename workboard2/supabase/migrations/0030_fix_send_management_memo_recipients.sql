-- Two independent bugs found while building the communication/learning UI
-- against 0028, both confirmed by direct execution against a freshly
-- migrated + seeded database (not just static reading of the SQL):
--
-- 1) send_management_memo referenced a bare `id` column from
--    active_executive_people(), a `setof uuid` function. Postgres only
--    names that output column `id` when a range alias is supplied (as the
--    other two call sites in 0028 correctly do, e.g.
--    `from active_executive_people() id`); left unaliased, the column is
--    named after the function itself. The unaliased call here made every
--    send_management_memo() invocation fail with
--    "column \"id\" does not exist", so no memo has ever been able to
--    reach a recipient. Fixed with the same aliasing already used
--    elsewhere in the file.
--
-- 2) management_memos' "memo sender read" policy and
--    management_memo_recipients' "memo recipient read" policy each embed
--    an `exists (select ... from <the other table> ...)` subquery
--    referencing each other. Any direct select against EITHER table (by
--    any authenticated role, regardless of row ownership) makes Postgres's
--    RLS rewriter expand table A's policy, which requires expanding table
--    B's policy, which requires re-expanding table A's — an unconditional
--    "infinite recursion detected in policy" error. This is not a corner
--    case: it means no one could ever read either table directly, which
--    is exactly what a HEAD's "view memo status/acknowledgements" screen
--    and an EXECUTIVE's memo inbox need to do. Fixed the same way this
--    codebase already breaks this class of cycle elsewhere (current_
--    person_id()/is_admin()/has_role(), 0001): a security definer helper
--    function's internal query runs as the function owner, which bypasses
--    RLS, so it can look at the other table without re-triggering that
--    table's own policy expansion.

create or replace function send_management_memo(
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
      and (pr.valid_to is null or pr.valid_to > current_date)
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
  select memo.id, id from active_executive_people() id;

  return memo;
end;
$$;

create function is_memo_recipient(p_memo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from management_memo_recipients r
    where r.memo_id = p_memo_id and r.recipient_person_id = current_person_id()
  );
$$;

create function is_memo_sender(p_memo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from management_memos m
    where m.id = p_memo_id and m.sender_person_id = current_person_id()
  );
$$;

drop policy "memo sender read" on management_memos;
create policy "memo sender read" on management_memos
for select using (
  sender_person_id = current_person_id()
  or is_admin()
  or is_memo_recipient(id)
);

drop policy "memo recipient read" on management_memo_recipients;
create policy "memo recipient read" on management_memo_recipients
for select using (
  recipient_person_id = current_person_id()
  or is_admin()
  or is_memo_sender(memo_id)
);
