-- WorkBoard 2.0 — hierarchy lifecycle integrity.
--
-- 1) Archived organizations must stop granting scoped permissions/capacity
--    membership immediately, without destroying historical grants.
-- 2) Ending a position also ends active appointments in that position.
-- 3) Ending a unit also ends active child positions and appointments in the
--    entire unit subtree. This prevents "active appointment in ended position"
--    contradictions.

create or replace function has_role_in_organization(check_role app_role, org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from person_roles pr
    join organizations o on o.id = pr.organization_id
    where pr.person_id = current_person_id()
      and pr.role = check_role
      and pr.organization_id = org_id
      and pr.valid_from <= current_date
      and (pr.valid_to is null or pr.valid_to > current_date)
      and o.is_active = true
  );
$$;

create or replace function person_organization_ids(check_person_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct ou.organization_id
  from appointments a
  join positions p on p.id = a.position_id
  join organization_units ou on ou.id = p.unit_id
  join organizations o on o.id = ou.organization_id
  where a.person_id = check_person_id
    and a.valid_from <= current_date
    and (a.valid_to is null or a.valid_to > current_date)
    and p.valid_from <= current_date
    and (p.valid_to is null or p.valid_to > current_date)
    and ou.valid_from <= current_date
    and (ou.valid_to is null or ou.valid_to > current_date)
    and o.is_active = true;
$$;

create function end_position_lifecycle(p_position_id uuid)
returns positions
language plpgsql
security definer
set search_path = public
as $$
declare
  result positions;
begin
  if not is_admin() then
    raise exception 'ต้องเป็นผู้ดูแลระบบเท่านั้น';
  end if;

  update appointments
  set valid_to = current_date
  where position_id = p_position_id
    and valid_to is null;

  update positions
  set valid_to = current_date
  where id = p_position_id
    and valid_to is null
  returning * into result;

  if result.id is null then
    raise exception 'ไม่พบตำแหน่งที่ใช้งานอยู่';
  end if;

  return result;
end;
$$;

create function end_unit_lifecycle(p_unit_id uuid)
returns organization_units
language plpgsql
security definer
set search_path = public
as $$
declare
  result organization_units;
begin
  if not is_admin() then
    raise exception 'ต้องเป็นผู้ดูแลระบบเท่านั้น';
  end if;

  if not exists (
    select 1 from organization_units
    where id = p_unit_id and valid_to is null
  ) then
    raise exception 'ไม่พบหน่วยงานที่ใช้งานอยู่';
  end if;

  with recursive unit_tree as (
    select id
    from organization_units
    where id = p_unit_id
    union all
    select child.id
    from organization_units child
    join unit_tree parent on child.parent_unit_id = parent.id
    where child.valid_to is null
  ),
  ended_appointments as (
    update appointments a
    set valid_to = current_date
    where a.valid_to is null
      and exists (
        select 1
        from positions p
        join unit_tree ut on ut.id = p.unit_id
        where p.id = a.position_id
      )
    returning a.id
  ),
  ended_positions as (
    update positions p
    set valid_to = current_date
    where p.valid_to is null
      and p.unit_id in (select id from unit_tree)
    returning p.id
  )
  update organization_units ou
  set valid_to = current_date
  where ou.valid_to is null
    and ou.id in (select id from unit_tree);

  select * into result
  from organization_units
  where id = p_unit_id;

  return result;
end;
$$;

grant execute on function end_position_lifecycle(uuid) to authenticated;
grant execute on function end_unit_lifecycle(uuid) to authenticated;
