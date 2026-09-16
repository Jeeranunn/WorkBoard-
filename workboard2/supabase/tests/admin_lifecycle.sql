-- WorkBoard 2.0 — admin lifecycle integrity.
-- Run after migrations 0001-0024 + seed.

set app.current_uid = '10000000-0000-0000-0000-000000000001'; -- ADMIN

-- Ending a position must end all active appointments that depend on it.
select end_position_lifecycle('30000000-0000-0000-0000-000000000006');

do $$
declare
  open_appointments int;
begin
  select count(*) into open_appointments
  from appointments
  where position_id = '30000000-0000-0000-0000-000000000006'
    and valid_to is null;

  if open_appointments <> 0 then
    raise exception 'ASSERTION_FAILURE: ended position left % active appointments', open_appointments;
  end if;

  raise notice 'OK: ending position ended dependent appointments';
end;
$$;

-- A person in an ended position must no longer resolve as an active member
-- of that organization.
do $$
declare
  n int;
begin
  select count(*) into n
  from person_organization_ids('20000000-0000-0000-0000-000000000005')
  where person_organization_ids = '30000000-0000-0000-0000-000000000002';

  if n <> 0 then
    raise exception 'ASSERTION_FAILURE: ended appointment still grants organization membership';
  end if;

  raise notice 'OK: ended hierarchy no longer grants active membership';
end;
$$;

-- Historical role grants can end and then be granted again without deleting
-- the old record.
update person_roles
set valid_to = current_date
where person_id = '20000000-0000-0000-0000-000000000006'
  and role = 'MEMBER'
  and organization_id = '30000000-0000-0000-0000-000000000003'
  and valid_to is null;

insert into person_roles (person_id, role, organization_id)
values (
  '20000000-0000-0000-0000-000000000006',
  'MEMBER',
  '30000000-0000-0000-0000-000000000003'
);

do $$
declare
  n int;
begin
  select count(*) into n
  from person_roles
  where person_id = '20000000-0000-0000-0000-000000000006'
    and role = 'MEMBER'
    and organization_id = '30000000-0000-0000-0000-000000000003';

  if n <> 2 then
    raise exception 'ASSERTION_FAILURE: role history/regrant expected 2 rows, saw %', n;
  end if;

  raise notice 'OK: role grants preserve history and allow a new active grant';
end;
$$;

-- Archiving an organization disables scoped permission and appointment-based
-- capacity membership without deleting historical rows.
update organizations
set is_active = false, archived_at = now()
where id = '30000000-0000-0000-0000-000000000003';

set app.current_uid = '10000000-0000-0000-0000-000000000004'; -- HEAD-B

do $$
begin
  if has_role_in_organization(
    'HEAD',
    '30000000-0000-0000-0000-000000000003'
  ) then
    raise exception 'ASSERTION_FAILURE: archived organization still grants HEAD permission';
  end if;

  raise notice 'OK: archived organization disables scoped HEAD permission';
end;
$$;

set app.current_uid = '10000000-0000-0000-0000-000000000001'; -- ADMIN

-- Unit subtree lifecycle cascade.
insert into organization_units (
  id, organization_id, parent_unit_id, name
) values
  (
    '30000000-0000-0000-0000-000000000010',
    '30000000-0000-0000-0000-000000000002',
    null,
    'หน่วยทดสอบแม่'
  ),
  (
    '30000000-0000-0000-0000-000000000011',
    '30000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000010',
    'หน่วยทดสอบลูก'
  );

insert into positions (id, unit_id, title)
values (
  '30000000-0000-0000-0000-000000000012',
  '30000000-0000-0000-0000-000000000011',
  'ตำแหน่งทดสอบ'
);

insert into appointments (person_id, position_id)
values (
  '20000000-0000-0000-0000-000000000005',
  '30000000-0000-0000-0000-000000000012'
);

select end_unit_lifecycle('30000000-0000-0000-0000-000000000010');

do $$
begin
  if exists (
    select 1 from organization_units
    where id in (
      '30000000-0000-0000-0000-000000000010',
      '30000000-0000-0000-0000-000000000011'
    )
      and valid_to is null
  ) then
    raise exception 'ASSERTION_FAILURE: unit subtree remained active';
  end if;

  if exists (
    select 1 from positions
    where id = '30000000-0000-0000-0000-000000000012'
      and valid_to is null
  ) then
    raise exception 'ASSERTION_FAILURE: child position remained active';
  end if;

  if exists (
    select 1 from appointments
    where position_id = '30000000-0000-0000-0000-000000000012'
      and valid_to is null
  ) then
    raise exception 'ASSERTION_FAILURE: child appointment remained active';
  end if;

  raise notice 'OK: ending unit cascades through child units, positions, appointments';
end;
$$;

reset app.current_uid;
select 'ALL ADMIN LIFECYCLE CHECKS PASSED' as result;
